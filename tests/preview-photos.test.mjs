import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";

const samples = ["ice-cream", "classroom", "sports", "sunset", "lunch", "rain", "cafe", "sky"].map(name => ({
  id: `sample-${name}`, date: "2026-09-01", imageUrl: `/images/demo/${name}.svg`, caption: name, people: [], tags: [],
}));
const exports = {};
const source = readFileSync(new URL("../lib/preview-photos.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "exports", compiled)(name => {
  assert.equal(name, "./data");
  return { SAMPLE_MEMORIES: samples };
}, exports);

test("preview has ten distinct decodable JPEG photos without changing ordinary samples", async () => {
  const photos = exports.PREVIEW_SAMPLE_MEMORIES;
  assert.equal(photos.length, 10);
  assert.equal(new Set(photos.map(memory => memory.imageUrl)).size, 10);
  for (const memory of photos) {
    assert.match(memory.imageUrl, /^\/images\/preview-photos\/[\w-]+\.jpg$/);
    const metadata = await sharp(readFileSync(new URL(`../public${memory.imageUrl}`, import.meta.url))).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.ok(metadata.width >= 1000 && metadata.height > 0);
  }
  assert.ok(samples.every(memory => memory.imageUrl.endsWith(".svg")));
});

test("saved preview samples move from SVG and missing remote photos to bundled photos", () => {
  const memory = { ...samples[5], caption: "edited caption", thumbnailUrl: "old thumbnail" };
  for (const imageUrl of ["/images/demo/rain.svg", "https://images.unsplash.com/photo-1504306665891-9f6e5d8b5d0a?auto=format&w=1000"]) {
    const restored = exports.restorePreviewPhoto({ ...memory, imageUrl });
    assert.equal(restored.imageUrl, "/images/preview-photos/rain.jpg");
    assert.equal(restored.thumbnailUrl, undefined);
    assert.equal(restored.caption, memory.caption);
    assert.equal(restored.id, memory.id);
  }
});

test("preview photo migration preserves user uploads and existing local photos", () => {
  for (const imageUrl of ["data:image/jpeg;base64,uploaded", "blob:https://example.test/upload", "https://storage.example.test/user-photo.jpg", "/images/preview-photos/rain.jpg"]) {
    const memory = { ...samples[0], imageUrl };
    assert.equal(exports.restorePreviewPhoto(memory), memory);
  }
});
