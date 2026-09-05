import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("small-photo surfaces use the thumbnail-first display URL", () => {
  const types = read("../lib/types.ts");
  assert.match(types, /thumbnailUrl\?: string/);
  assert.match(types, /return memory\.thumbnailUrl \?\? memory\.imageUrl/);

  for (const path of [
    "../components/memory-card.tsx",
    "../components/growing-tree.tsx",
    "../components/fruit-quiz-dialog.tsx",
    "../components/memory-recall-dialog.tsx",
    "../components/quiz-question-card.tsx",
    "../components/quiz-session.tsx",
    "../lib/quiz.ts",
  ]) {
    assert.match(read(path), /getMemoryDisplayUrl/);
  }
});

test("detail and high-quality output keep using explicit original URLs", () => {
  const detail = read("../app/memory/[id]/page.tsx");
  const albumSettings = read("../app/memory/[id]/album-settings/page.tsx");
  const book = read("../components/memory-book-page.tsx");
  const album = read("../app/album/page.tsx");
  assert.match(detail, /loadMemory\(createClient\(\), params\.id\)/);
  assert.match(albumSettings, /loadMemory\(createClient\(\), params\.id\)/);
  assert.match(book, /src=\{memory\.imageUrl\}/);
  assert.match(album, /loadMemoryOriginalUrls\(createClient\(\), memories\)/);
});

test("photo selection starts thumbnail generation before save", () => {
  const form = read("../components/memory-form.tsx");
  assert.match(form, /thumbnailPromiseRef\.current = createMemoryThumbnail\(file\)/);
  assert.match(form, /thumbnail: "サムネイルを準備しています/);
  assert.match(form, /saveMemory\(createClient\(\), \{ image, thumbnail,/);
});
