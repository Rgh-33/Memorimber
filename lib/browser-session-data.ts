const APP_PREFIX = "memorimber-";
const THEME_KEYS = new Set(["memorimber-theme", "memorimber-color-mode"]);
export const SESSION_RESET_CHANNEL = "memorimber-session-reset";
export const SESSION_RESET_KEY = "memorimber-session-reset-signal";

let writesAllowed = true;

export function allowBrowserSessionWrites(allowed: boolean) {
  writesAllowed = allowed;
}

/** Late callbacks from an unmounted quiz/upload must not recreate deleted data. */
export function setBrowserSessionItem(storage: Pick<Storage, "setItem">, key: string, value: string) {
  if (!writesAllowed) return false;
  storage.setItem(key, value);
  return true;
}

type StorageSource = () => Pick<Storage, "length" | "key" | "removeItem">;

/** Access each storage separately: one failure must not skip the other store. */
export function clearBrowserSessionData(local: StorageSource, session: StorageSource): boolean {
  let succeeded = true;
  for (const [source, preserveTheme] of [[local, true], [session, false]] as const) {
    try {
      const storage = source();
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (!key?.startsWith(APP_PREFIX) || (preserveTheme && THEME_KEYS.has(key))) continue;
        try { storage.removeItem(key); } catch { succeeded = false; }
      }
    } catch { succeeded = false; }
  }
  return succeeded;
}

export function isPublicAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/");
}
