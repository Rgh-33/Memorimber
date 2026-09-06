import assert from "node:assert/strict";
import test from "node:test";
import { allowBrowserSessionWrites, clearBrowserSessionData, setBrowserSessionItem } from "../lib/browser-session-data.ts";

function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
}

test("logout removes existing and future app data, retaining only local theme and unrelated keys", () => {
  const local = storage({
    "memorimber-quiz-history-v1": '[{"memoryCaption":"Aの思い出"}]',
    "memorimber-quiz-photo-to-caption-count": "20",
    "memorimber-bgm-volume-level": "5",
    "memorimber-theme": "purple",
    "memorimber-color-mode": "dark",
    "memorimber-future-private-data": "private",
    "other-app": "untouched",
  });
  const session = storage({
    "memorimber-konohaan-v1:user-a": "preview",
    "memorimber-pending-memory-upload": "upload",
    "memorimber-album-return-position-v1": "position",
    "memorimber-theme": "not a local theme setting",
    "other-app": "untouched",
  });
  assert.equal(clearBrowserSessionData(() => local, () => session), true);
  assert.deepEqual(Object.fromEntries(local.data), {
    "memorimber-theme": "purple", "memorimber-color-mode": "dark", "other-app": "untouched",
  });
  assert.deepEqual(Object.fromEntries(session.data), { "other-app": "untouched" });
  assert.equal(clearBrowserSessionData(() => local, () => session), true, "retries are idempotent");
});

test("failed removal still attempts every other key and the other storage", () => {
  const local = storage({ "memorimber-quiz-history-v1": "history", "memorimber-memory-recall-v1": "recall" });
  const session = storage({ "memorimber-pending-memory-upload": "upload" });
  const remove = local.removeItem;
  local.removeItem = (key) => {
    if (key === "memorimber-quiz-history-v1") throw new Error("blocked");
    remove(key);
  };
  assert.equal(clearBrowserSessionData(() => local, () => session), false);
  assert.deepEqual([...local.data.keys()], ["memorimber-quiz-history-v1"]);
  assert.equal(session.length, 0);
});

test("an inaccessible storage getter does not skip cleanup of the other store", () => {
  const session = storage({ "memorimber-pending-memory-upload": "upload" });
  assert.equal(clearBrowserSessionData(() => { throw new Error("SecurityError"); }, () => session), false);
  assert.equal(session.length, 0);
});

test("late quiz and upload callbacks cannot recreate data after logout starts", () => {
  const local = storage();
  const session = storage();
  allowBrowserSessionWrites(true);
  assert.equal(setBrowserSessionItem(local, "memorimber-quiz-history-v1", "history"), true);
  assert.equal(local.length, 1, "ordinary saves remain enabled during a visit");
  allowBrowserSessionWrites(false);
  clearBrowserSessionData(() => local, () => session);
  assert.equal(setBrowserSessionItem(local, "memorimber-quiz-history-v1", "late history"), false);
  assert.equal(setBrowserSessionItem(session, "memorimber-pending-memory-upload", "late upload"), false);
  assert.equal(local.length, 0);
  assert.equal(session.length, 0);
  allowBrowserSessionWrites(true);
  setBrowserSessionItem(local, "memorimber-quiz-history-v1", "new visit");
  assert.equal(local.data.get("memorimber-quiz-history-v1"), "new visit");
});
