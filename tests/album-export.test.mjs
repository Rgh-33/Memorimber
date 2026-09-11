import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as pdfLib from "pdf-lib";
import sharp from "sharp";

async function renderer(ios = false) {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff3f0" } }).png().toBuffer();
  const calls = [];
  const htmlToImage = {
    getFontEmbedCSS: async () => "embedded-fonts",
    toPng: async (element, options) => { calls.push({ id: element.id, options }); return `data:image/png;base64,${png.toString("base64")}`; },
  };
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/album-pdf.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", "document", "navigator", "getComputedStyle", "requestAnimationFrame", compiled)(
    name => { if (name === "pdf-lib") return pdfLib; if (name === "html-to-image") return htmlToImage; throw new Error(name); },
    exports, { fonts: { ready: Promise.resolve() } }, { userAgent: ios ? "iPhone AppleWebKit" : "Chrome", platform: "", maxTouchPoints: 0 },
    () => ({ backgroundColor: "rgb(255, 243, 240)" }), callback => callback(),
  );
  const element = id => {
    const images = [{ src: `data:image/png;base64,${png.toString("base64")}`, srcset: "", complete: true, naturalWidth: 2, naturalHeight: 2, decode: async () => { calls.push({ decoded: id }); } }];
    return { id, querySelectorAll: () => images, contains: image => images.includes(image), getBoundingClientRect: () => ({ width: 310, height: 310 * 127 / 89 }) };
  };
  return { exports, calls, element };
}

test("monthly export creates one L-size PDF page per paper, in order, without text headers", async () => {
  const h = await renderer();
  const blob = await h.exports.createAlbumPagesPdf([h.element("cover"), h.element("page-2"), h.element("page-3")], "portrait");
  const pdf = await pdfLib.PDFDocument.load(await blob.arrayBuffer());
  assert.equal(blob.type, "application/pdf");
  assert.equal(pdf.getPageCount(), 3);
  assert.deepEqual(h.calls.filter(call => call.options).map(call => call.id), ["cover", "page-2", "page-3"]);
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 89 / 25.4 * 72) < 1e-9);
    assert.ok(Math.abs(page.getHeight() - 127 / 25.4 * 72) < 1e-9);
  }
  assert.ok(h.calls.filter(call => call.options).every(call => call.options.backgroundColor === "rgb(255, 243, 240)" && call.options.fontEmbedCSS === "embedded-fonts"));
});

test("single PDF keeps landscape L dimensions and iOS warm-up for each image", async () => {
  const h = await renderer(true);
  const blob = await h.exports.createAlbumPdf(h.element("single"), "landscape");
  const pdf = await pdfLib.PDFDocument.load(await blob.arrayBuffer());
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 127 / 25.4 * 72) < 1e-9);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 89 / 25.4 * 72) < 1e-9);
  assert.equal(h.calls.filter(call => call.options).length, 2);
  assert.equal(h.calls[0].decoded, "single");
});

test("PNG export renders only the requested page and returns a valid PNG blob", async () => {
  const h = await renderer();
  const blob = await h.exports.createAlbumPng(h.element("page-2"), "portrait");
  assert.equal(blob.type, "image/png");
  const metadata = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
  assert.equal(metadata.format, "png");
  assert.deepEqual(h.calls.filter(call => call.options).map(call => call.id), ["page-2"]);
  await assert.rejects(() => h.exports.createAlbumPagesPdf([], "portrait"), /紙面がありません/);
});


test("prepared monthly pages release images before preparing the next page", async () => {
  const h = await renderer(true);
  let retained = 0;
  const events = [];
  async function* pages() {
    for (const id of ["cover", "page-2"]) {
      assert.equal(retained, 0);
      retained += 1;
      try {
        events.push(`prepare:${id}`);
        yield { element: h.element(id), imageCount: 1 };
        assert.ok(h.calls.some(call => call.id === id));
      } finally { retained -= 1; events.push(`release:${id}`); }
    }
  }
  const pdf = await pdfLib.PDFDocument.load(await (await h.exports.createAlbumPagesPdf(pages(), "portrait")).arrayBuffer());
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(retained, 0);
  assert.deepEqual(events, ["prepare:cover", "release:cover", "prepare:page-2", "release:page-2"]);
  assert.equal(h.calls.filter(call => call.options).length, 4);
});

test("monthly PNG refuses remote, missing, undecodable, or empty images before rasterizing", async () => {
  for (const failure of ["remote", "missing", "decode", "empty"]) {
    const h = await renderer();
    const page = h.element(failure);
    const image = page.querySelectorAll()[0];
    if (failure === "remote") image.src = "https://example.test/signed?token=private";
    if (failure === "missing") page.querySelectorAll = () => [];
    if (failure === "decode") image.decode = async () => { throw new Error("bad image"); };
    if (failure === "empty") image.naturalWidth = 0;
    await assert.rejects(() => h.exports.createAlbumPng(page, "portrait", 1), /写真/);
    assert.equal(h.calls.filter(call => call.options).length, 0);
  }
});

test("failed monthly PDF closes the page generator and never prepares another page", async () => {
  const h = await renderer();
  let released = false;
  let advanced = false;
  async function* pages() {
    try {
      yield { element: h.element("missing-photo"), imageCount: 6 };
      advanced = true;
    } finally { released = true; }
  }
  await assert.rejects(() => h.exports.createAlbumPagesPdf(pages(), "portrait"), /写真/);
  assert.equal(released, true);
  assert.equal(advanced, false);
});
