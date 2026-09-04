import assert from "node:assert/strict";
import test from "node:test";
import { acquireBodyScrollLock } from "../lib/body-scroll-lock.ts";

test("nested body scroll locks restore the original overflow only after the final release", () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const style = { overflow: "visible" };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { body: { style } },
  });

  try {
    const releaseDialog = acquireBodyScrollLock();
    assert.equal(style.overflow, "hidden");

    const releaseFlight = acquireBodyScrollLock();
    releaseDialog();
    assert.equal(style.overflow, "hidden");

    releaseFlight();
    assert.equal(style.overflow, "visible");

    const releaseFirst = acquireBodyScrollLock();
    const releaseSecond = acquireBodyScrollLock();
    releaseSecond();
    releaseSecond();
    assert.equal(style.overflow, "hidden");

    releaseFirst();
    assert.equal(style.overflow, "visible");
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }

  assert.doesNotThrow(() => acquireBodyScrollLock()());
});
