import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function converter(fetchImage, readerFailure = false) {
  const exports = {};
  class Reader {
    readAsDataURL(blob) {
      if (readerFailure) { this.onerror(); return; }
      void blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload();
      });
    }
    abort() { this.onabort?.(); }
  }
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/album-export-images.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("exports", "fetch", "FileReader", compiled)(exports, fetchImage, Reader);
  return exports.loadAlbumExportImage;
}

test("export fetches the signed URL once and produces self-contained image data", async () => {
  const calls = [];
  const convert = converter(async (url, options) => {
    calls.push({ url, options });
    return new Response(new Blob(["image bytes"], { type: "image/png" }));
  });
  const result = await convert("https://example.test/photo?token=private", new AbortController().signal);
  assert.equal(result, `data:image/png;base64,${Buffer.from("image bytes").toString("base64")}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "omit");
});

test("fetch, HTTP, blob and conversion failures reject without exposing signed URLs", async () => {
  const failures = [
    [async () => { throw new Error("https://example.test?token=private"); }, false],
    [async () => new Response("denied", { status: 403 }), false],
    [async () => ({ ok: true, blob: async () => { throw new Error("bad blob"); } }), false],
    [async () => new Response(new Blob([], { type: "image/png" })), false],
    [async () => new Response("not an image"), false],
    [async () => new Response(new Blob(["bytes"], { type: "image/png" })), true],
  ];
  for (const [fetchImage, readerFailure] of failures) {
    await assert.rejects(() => converter(fetchImage, readerFailure)("https://example.test?token=private", new AbortController().signal), error => {
      assert.match(error.message, /変換できません/);
      assert.doesNotMatch(error.message, /private|https:/);
      return true;
    });
  }
});
