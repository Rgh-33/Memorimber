import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAlbumFirstColumn, getAlbumGridSlotCount, orderAlbumMemories } from "../lib/album-grid.ts";

const memory = (id, date, createdAt = undefined) => ({ id, date, createdAt, imageUrl: "photo.jpg", caption: id, people: [], tags: [] });

test("album chronology ends with the newest photo", () => {
  const ordered = orderAlbumMemories([
    memory("newest", "2026-09-03"),
    memory("oldest", "2026-09-01"),
    memory("same-day-later", "2026-09-02", "2026-09-02T12:00:02Z"),
    memory("same-day-earlier", "2026-09-02", "2026-09-02T12:00:01Z"),
  ]);
  assert.deepEqual(ordered.map((item) => item.id), ["oldest", "same-day-earlier", "same-day-later", "newest"]);
});

test("partial oldest row is right aligned so newest is bottom-right", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(getAlbumFirstColumn), [3, 2, 1, 3, 2, 1]);
});

test("every month reserves the fullest month's complete grid rows", () => {
  assert.equal(getAlbumGridSlotCount([]), 3);
  assert.equal(getAlbumGridSlotCount([1, 7, 16, 4]), 18);
  assert.equal(getAlbumGridSlotCount([3, 6, 9]), 9);
});

test("month navigation stays after print in normal flow and the app allows vertical scrolling", () => {
  const albumPage = readFileSync(new URL("../app/album/page.tsx", import.meta.url), "utf8");
  const appShell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  const memoryPage = readFileSync(new URL("../app/memory/[id]/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const switcherRule = css.match(/\.album-month-switcher\s*\{([^}]+)\}/)?.[1] ?? "";

  assert.ok(albumPage.indexOf("album-month-switcher") > albumPage.indexOf("月をプリントする"));
  assert.doesNotMatch(appShell, /overflow-hidden/);
  assert.match(css, /\.app-shell\s*\{[^}]*overflow-y:\s*visible/s);
  assert.match(appShell, /pathname === "\/album"/);
  assert.match(appShell, /app-shell--album/);
  assert.match(css, /\.app-shell--album\s*\{[^}]*overflow:\s*visible/s);
  assert.doesNotMatch(switcherRule, /position:\s*(?:fixed|sticky)/);
  assert.match(switcherRule, /scroll-margin-bottom/);
  assert.match(albumPage, /onClickCapture=\{rememberAlbumPosition\}/);
  assert.match(albumPage, /scrollAlbumImmediately\(\(\) => bottomRef\.current\?\.scrollIntoView/);
  assert.match(albumPage, /url\.searchParams\.get\("restore"\) === "1"/);
  assert.match(albumPage, /if \(didPrepareScrollRestore\.current\) return/);
  assert.match(memoryPage, /href="\/album\?restore=1"/);
  assert.match(memoryPage, /href="\/album\?restore=1"[\s\S]*?scroll=\{false\}/);
});
