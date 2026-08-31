import assert from "node:assert/strict";
import test from "node:test";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { getLoginErrorCode } from "../lib/login-error.ts";

test("network denial is not reported as a wrong password", () => {
  assert.equal(getLoginErrorCode(new AuthRetryableFetchError("fetch failed", 0)), "network_error");
  assert.equal(getLoginErrorCode(new TypeError("fetch failed", { cause: { code: "EACCES" } })), "network_error");
  assert.equal(getLoginErrorCode(new AuthApiError("Timed out", 408, "request_timeout")), "network_error");
});

test("invalid credentials and unconfirmed email produce different recovery messages", () => {
  assert.equal(getLoginErrorCode(new AuthApiError("Invalid login credentials", 400, "invalid_credentials")), "invalid_credentials");
  assert.equal(getLoginErrorCode(new AuthApiError("Email not confirmed", 400, "email_not_confirmed")), "email_not_confirmed");
});

test("rate limits and server outages are not credential failures", () => {
  assert.equal(getLoginErrorCode(new AuthApiError("Too many requests", 429, "over_request_rate_limit")), "rate_limited");
  assert.equal(getLoginErrorCode(new AuthRetryableFetchError("Service unavailable", 503)), "service_unavailable");
});

test("unknown errors use a safe generic code without echoing error details", () => {
  for (const error of [null, undefined, new Error("Internal details"), new AuthApiError("Unexpected", 400, "unexpected_failure")]) {
    assert.equal(getLoginErrorCode(error), "login_failed");
  }
});
