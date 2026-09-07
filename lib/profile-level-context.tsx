"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMemories } from "@/lib/memories-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { profileProgressView, type ProfileProgressSnapshot } from "@/lib/profile-progress";
import type { LevelActivityMetric, LevelActivityStats } from "@/lib/profile-data";

type Value = ReturnType<typeof profileProgressView> & {
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordActivity: (metric: LevelActivityMetric, options?: { eventId?: string; amount?: number; memoryId?: string }) => void;
  setActivityTotals: (values: Partial<LevelActivityStats>) => void;
};
const ProfileLevelContext = createContext<Value | null>(null);

export function ProfileLevelProvider({ children }: { children: ReactNode }) {
  const { memories } = useMemories();
  const [snapshot, setSnapshot] = useState<ProfileProgressSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    if (!isSupabaseConfigured()) return Promise.resolve();
    pending.current = (async () => {
      try {
        const { data, error: failure } = await createClient().rpc("get_profile_progress");
        if (failure) throw failure;
        setSnapshot(data as ProfileProgressSnapshot);
        setError(null);
        setReady(true);
      } catch { setError("記録を読み込めませんでした。時間をおいて再読み込みしてください。"); }
      finally { pending.current = null; }
    })();
    return pending.current;
  }, []);
  useEffect(() => { void refresh(); }, [refresh, memories]);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = createClient();
    let disposed = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    void client.auth.getUser().then(({ data }) => {
      if (!data.user || disposed) return;
      channel = client.channel(`profile-progress:${data.user.id}`).on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profile_progress", filter: `user_id=eq.${data.user.id}`,
      }, () => { void refresh(); }).on("postgres_changes", { event: "*", schema: "public", table: "profile_identity_versions", filter: `user_id=eq.${data.user.id}` }, () => { void refresh(); }).subscribe();
    });
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("memorimber:profile-invalidated", onFocus);
    return () => {
      disposed = true;
      if (channel) void client.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("memorimber:profile-invalidated", onFocus);
    };
  }, [refresh]);
  const recordActivity = useCallback<Value["recordActivity"]>((metric, options) => {
    // PostgreSQL success events already update progress in their transaction.
    // Only inherently client-observed events use this endpoint.
    if (metric !== "printAttempts" && metric !== "wordRecallReveals") { void refresh(); return; }
    if (!isSupabaseConfigured()) return;
    const source = options?.eventId ?? crypto.randomUUID();
    void createClient().rpc("record_profile_client_event", { p_type: metric, p_source: source, p_memory: options?.memoryId ?? null }).then(({ data, error: failure }) => {
      if (failure) setError("記録を保存できませんでした。時間をおいて再度お試しください。");
      else { setSnapshot(data as ProfileProgressSnapshot); setError(null); }
    });
  }, [refresh]);
  const setActivityTotals = useCallback(() => { void refresh(); }, [refresh]);
  const value = useMemo<Value>(() => ({ ...profileProgressView(snapshot), ready, error, refresh, recordActivity, setActivityTotals }), [snapshot, ready, error, refresh, recordActivity, setActivityTotals]);
  return <ProfileLevelContext.Provider value={value}>{children}</ProfileLevelContext.Provider>;
}
export function useProfileLevel() {
  const value = useContext(ProfileLevelContext);
  if (!value) throw new Error("useProfileLevel must be used within ProfileLevelProvider");
  return value;
}
