import assert from "node:assert/strict";
import test from "node:test";
import {
  createMemoryThumbnail,
  MEMORY_THUMBNAIL_SIZE,
  MEMORY_THUMBNAIL_TARGET_BYTES,
} from "../lib/memory-thumbnail.ts";

function replaceGlobal(t, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
}

function installCanvas(t, encode) {
  const draws = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: (...args) => draws.push(args),
    }),
    toBlob: (callback, type, quality) => callback(encode(type, quality)),
  };
  replaceGlobal(t, "document", { createElement: (tag) => {
    assert.equal(tag, "canvas");
    return canvas;
  } });
  return { canvas, draws };
}

test("a landscape thumbnail is center-cropped to 110 by 110 WebP and closes decoded pixels", async (t) => {
  let closed = false;
  replaceGlobal(t, "createImageBitmap", async () => ({ width: 1600, height: 800, close: () => { closed = true; } }));
  const qualities = [];
  const { canvas, draws } = installCanvas(t, (type, quality) => {
    qualities.push(quality);
    return new Blob([new Uint8Array(MEMORY_THUMBNAIL_TARGET_BYTES - 1)], { type });
  });
  const result = await createMemoryThumbnail(new File(["original"], "photo.jpg", { type: "image/jpeg" }));
  assert.equal(canvas.width, MEMORY_THUMBNAIL_SIZE);
  assert.equal(canvas.height, MEMORY_THUMBNAIL_SIZE);
  assert.equal(draws.length, 1);
  assert.deepEqual(draws[0].slice(1), [400, 0, 800, 800, 0, 0, 110, 110]);
  assert.deepEqual(qualities, [0.65]);
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.extension, "webp");
  assert.equal(closed, true);
});

test("a portrait thumbnail is center-cropped without stretching", async (t) => {
  replaceGlobal(t, "createImageBitmap", async () => ({ width: 600, height: 900, close: () => undefined }));
  const { canvas, draws } = installCanvas(t, (type) => new Blob(["thumbnail"], { type }));
  await createMemoryThumbnail(new File(["original"], "portrait.jpg", { type: "image/jpeg" }));
  assert.deepEqual([canvas.width, canvas.height], [110, 110]);
  assert.deepEqual(draws[0].slice(1), [0, 150, 600, 600, 0, 0, 110, 110]);
});

test("encoding lowers quality until the 10 KiB soft target is reached", async (t) => {
  replaceGlobal(t, "createImageBitmap", async () => ({ width: 400, height: 400, close: () => undefined }));
  const qualities = [];
  installCanvas(t, (type, quality) => {
    qualities.push(quality);
    const size = quality > 0.4 ? MEMORY_THUMBNAIL_TARGET_BYTES + 1 : MEMORY_THUMBNAIL_TARGET_BYTES;
    return new Blob([new Uint8Array(size)], { type });
  });
  const result = await createMemoryThumbnail(new File(["original"], "square.jpg", { type: "image/jpeg" }));
  assert.equal(result.blob.size, MEMORY_THUMBNAIL_TARGET_BYTES);
  assert.deepEqual(qualities, [0.65, 0.5, 0.4]);
});

test("unsupported WebP encoding falls back to a JPEG thumbnail", async (t) => {
  replaceGlobal(t, "createImageBitmap", async () => ({ width: 600, height: 900, close: () => undefined }));
  installCanvas(t, (type) => type === "image/webp"
    ? new Blob(["png fallback"], { type: "image/png" })
    : new Blob(["jpeg fallback"], { type: "image/jpeg" }));
  const result = await createMemoryThumbnail(new File(["original"], "photo.png", { type: "image/png" }));
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.extension, "jpg");
});

test("an undecodable image returns null instead of failing the post", async (t) => {
  replaceGlobal(t, "createImageBitmap", async () => { throw new Error("HEIC unsupported"); });
  installCanvas(t, () => { throw new Error("canvas should not encode"); });
  assert.equal(
    await createMemoryThumbnail(new File(["heic"], "photo.heic", { type: "image/heic" })),
    null,
  );
});
