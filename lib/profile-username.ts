import { getSafeAuthRedirect } from "./auth-redirect.ts";

export const PROFILE_USERNAME_MAX_LENGTH = 20;
export const USERNAME_ONBOARDING_PATH = "/onboarding/username";

export type ProfileUsernameError = "missing_username" | "username_too_long";

export type ProfileUsernameValidation =
  | { username: string; error: null }
  | { username: null; error: ProfileUsernameError };

export function validateProfileUsername(value: unknown): ProfileUsernameValidation {
  const username = typeof value === "string" ? value.trim() : "";
  if (!username) return { username: null, error: "missing_username" };
  if (username.length > PROFILE_USERNAME_MAX_LENGTH) {
    return { username: null, error: "username_too_long" };
  }
  return { username, error: null };
}

export function getSafePostUsernameRedirect(value: FormDataEntryValue | string | null | undefined) {
  const next = getSafeAuthRedirect(value);
  const pathname = new URL(next, "http://localhost").pathname;
  if (
    pathname === USERNAME_ONBOARDING_PATH
    || pathname === "/login"
    || pathname === "/signup"
    || pathname.startsWith("/auth/")
  ) {
    return "/";
  }
  return next;
}
