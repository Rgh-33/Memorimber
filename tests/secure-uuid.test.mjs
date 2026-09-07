import assert from "node:assert/strict";
import test from "node:test";
import { createSecureUuid } from "../lib/secure-uuid.ts";

function replaceCrypto(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete globalThis.crypto;
  });
}

test("native UUID is called with its Crypto receiver", (t) => {
  const native = { randomUUID() { assert.equal(this, native); return "00000000-0000-4000-8000-000000000001"; } };
  replaceCrypto(t, native);
  assert.equal(createSecureUuid(), "00000000-0000-4000-8000-000000000001");
});
for (const [byte, expected] of [[0, "00000000-0000-4000-8000-000000000000"], [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"]]) {
  test(`missing randomUUID falls back to secure RFC v4 bytes (${byte})`, (t) => {
    const fallback = { getRandomValues(bytes) { assert.equal(this, fallback); assert.equal(bytes.length, 16); return bytes.fill(byte); } };
    replaceCrypto(t, fallback);
    t.mock.method(Math, "random", () => { throw new Error("insecure randomness must not be used"); });
    assert.equal(createSecureUuid(), expected);
  });
}
for (const unavailable of [undefined, {}]) {
  test(`unavailable secure randomness returns no event identifier (${typeof unavailable})`, (t) => {
    replaceCrypto(t, unavailable);
    assert.equal(createSecureUuid(), null);
  });
}
