export type LoginErrorCode = "invalid_credentials" | "network_error" | "email_not_confirmed"
  | "rate_limited" | "service_unavailable" | "login_failed";

/** Do not describe transport failures as a wrong password, or expose raw errors. */
export function getLoginErrorCode(error: unknown): LoginErrorCode {
  if (!error || typeof error !== "object") return "login_failed";
  const { code, status, name, cause } = error as {
    code?: string; status?: number; name?: string; cause?: { code?: string };
  };
  if (status === 429 || code === "over_request_rate_limit") return "rate_limited";
  if (status !== undefined && status >= 500) return "service_unavailable";
  if (status === 0 || name === "AuthRetryableFetchError" || code === "request_timeout"
    || ["EACCES", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(cause?.code ?? "")) {
    return "network_error";
  }
  if (code === "email_not_confirmed") return "email_not_confirmed";
  if (code === "invalid_credentials") return "invalid_credentials";
  return "login_failed";
}
