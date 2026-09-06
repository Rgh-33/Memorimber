"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { allowBrowserSessionWrites, clearBrowserSessionData, isPublicAuthPath, SESSION_RESET_CHANNEL, SESSION_RESET_KEY } from "@/lib/browser-session-data";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const LogoutContext = createContext<(() => void) | null>(null);
const STORAGE_ERROR = "端末内の履歴を削除できませんでした。ブラウザのストレージ設定を確認して再試行してください。";
type ResetMessage = "started" | "finished";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const resetting = useRef(false);
  const loggingOut = useRef(false);
  const owner = useRef<string | null>(null);
  const deletionNotified = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const clear = useCallback(() => clearBrowserSessionData(
    () => window.localStorage, () => window.sessionStorage,
  ), []);

  const notify = useCallback((message: ResetMessage) => {
    try { channel.current?.postMessage(message); } catch { /* Use storage events below. */ }
    try {
      // Transient signal for browsers without BroadcastChannel; retain no user data.
      localStorage.setItem(SESSION_RESET_KEY, message);
      localStorage.removeItem(SESSION_RESET_KEY);
    } catch { /* Storage can be blocked independently of BroadcastChannel. */ }
  }, []);

  const block = useCallback(() => {
    resetting.current = true;
    allowBrowserSessionWrites(false);
    setReadyPath(null);
    setError(null);
  }, []);

  const finish = useCallback(() => {
    if (!clear()) {
      setError(STORAGE_ERROR);
      return;
    }
    window.location.replace("/login?message=signed_out");
  }, [clear]);

  const performLogout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    // Unmount all data providers before clearing so effects cannot restore data.
    flushSync(block);
    notify("started");
    const cleared = clear();
    try {
      const result = await logout();
      if (result.error) {
        setError(result.error);
        return;
      }
      notify("finished");
      if (!cleared && !clear()) {
        setError(STORAGE_ERROR);
        return;
      }
      finish();
    } catch {
      setError("ログアウトできませんでした。通信状態を確認して再試行してください。");
    } finally {
      loggingOut.current = false;
    }
  }, [block, clear, finish, notify]);

  useEffect(() => {
    const receive = (message: unknown) => {
      if (message !== "started" && message !== "finished") return;
      flushSync(block);
      const cleared = clear();
      if (!cleared) setError(STORAGE_ERROR);
      else if (message === "finished") finish();
    };
    try {
      channel.current = new BroadcastChannel(SESSION_RESET_CHANNEL);
      channel.current.onmessage = (event: MessageEvent) => receive(event.data);
    } catch { /* storage events also notify other tabs. */ }
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_RESET_KEY) receive(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("storage", onStorage);
    };
  }, [block, clear, finish]);

  useEffect(() => {
    let active = true;
    let version = 0;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const publicPage = isPublicAuthPath(pathname);
    const configured = isSupabaseConfigured();
    const client = configured ? createClient() : null;

    const verify = async () => {
      if (resetting.current) return;
      const request = ++version;
      try {
        const result = client ? await client.auth.getUser() : null;
        if (!active || request !== version || resetting.current) return;
        const user = result?.data.user ?? null;
        const authError = result?.error;
        if (authError && authError.name !== "AuthSessionMissingError" && ![401, 403].includes(authError.status ?? 0)) {
          throw new Error("ログイン状態を確認できませんでした。通信状態を確認して再試行してください。");
        }
        if (publicPage) {
          if (user) {
            // Middleware is authoritative for leaving public auth pages. If it
            // rendered this page, a stale client-side session must not send the
            // browser back to a server-protected page in a redirect loop.
            owner.current = user.id;
            deletionNotified.current = false;
            allowBrowserSessionWrites(true);
          } else {
            allowBrowserSessionWrites(false);
            if (!clear()) throw new Error(STORAGE_ERROR);
            owner.current = null;
            if (!deletionNotified.current && new URLSearchParams(window.location.search).get("message") === "account_deleted") {
              deletionNotified.current = true;
              notify("finished");
            }
          }
        } else if (client) {
          if (!user || (owner.current && owner.current !== user.id)) {
            flushSync(block);
            if (!clear()) { setError(STORAGE_ERROR); return; }
            if (!user) notify("finished");
            window.location.replace(user ? window.location.href : "/login");
            return;
          }
          owner.current = user.id;
          deletionNotified.current = false;
          allowBrowserSessionWrites(true);
        } else {
          allowBrowserSessionWrites(true);
        }
        if (active && request === version) {
          setError(null);
          setReadyPath(pathname);
        }
      } catch (cause) {
        if (!active || request !== version || resetting.current) return;
        allowBrowserSessionWrites(false);
        setReadyPath(null);
        setError(cause instanceof Error ? cause.message : "ログイン状態を確認できませんでした。");
      }
    };

    void verify();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" && event !== "SIGNED_IN") return;
      // Never call another auth method while the auth callback holds its lock.
      clearTimeout(authTimer);
      authTimer = setTimeout(() => { void verify(); }, 0);
    }).data.subscription;
    const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        allowBrowserSessionWrites(false);
        flushSync(() => setReadyPath(null));
        window.location.reload();
      }
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      clearTimeout(authTimer);
      subscription?.unsubscribe();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [pathname, attempt, block, clear, notify]);

  const readyForPage = readyPath !== null && isPublicAuthPath(readyPath) === isPublicAuthPath(pathname);
  if (!readyForPage || error) {
    return <main className="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center gap-4 bg-ivory px-6 text-center text-sm text-ink">
      <p role={error ? "alert" : "status"}>{error ?? (resetting.current ? "ログアウトしています…" : "読み込み中…")}</p>
      {(error || resetting.current) && <button type="button" className="rounded-lg border border-line px-4 py-3" onClick={() => {
        if (resetting.current) void performLogout();
        else { setError(null); setAttempt((value) => value + 1); }
      }}>{error ? "再試行" : "ログアウトを完了する"}</button>}
    </main>;
  }

  return <LogoutContext.Provider value={() => { void performLogout(); }}>{children}</LogoutContext.Provider>;
}

export function LogoutButton({ children, className }: { children: ReactNode; className?: string }) {
  const onLogout = useContext(LogoutContext);
  if (!onLogout) throw new Error("LogoutButton must be inside SessionBoundary");
  return <button type="button" className={className} onClick={onLogout}>{children}</button>;
}
