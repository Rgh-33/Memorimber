const DEFAULT_AUTH_REDIRECT = "/";

/**
 * Accept only same-origin application paths for post-authentication redirects.
 * The returned value keeps the query string, but deliberately drops fragments
 * because they are never sent to the server during an Auth callback.
 */
export function getSafeAuthRedirect(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return DEFAULT_AUTH_REDIRECT;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
