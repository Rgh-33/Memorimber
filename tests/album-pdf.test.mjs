import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAlbumPdfFilename, getAlbumPdfPageSize, L_PHOTO_PAPER_MM } from "../lib/album-pdf.ts";

const memoryPage = readFileSync(new URL("../app/memory/[id]/page.tsx", import.meta.url), "utf8");
const pdfSource = readFileSync(new URL("../lib/album-pdf.ts", import.meta.url), "utf8");

test("album PDF uses exact Japanese L-size dimensions without margins", () => {
  assert.deepEqual(L_PHOTO_PAPER_MM.portrait, { width: 89, height: 127 });
  assert.deepEqual(L_PHOTO_PAPER_MM.landscape, { width: 127, height: 89 });

  const portrait = getAlbumPdfPageSize("portrait");
  const landscape = getAlbumPdfPageSize("landscape");
  assert.ok(Math.abs(portrait.width / portrait.height - 89 / 127) < 1e-12);
  assert.ok(Math.abs(landscape.width / landscape.height - 127 / 89) < 1e-12);
  assert.equal(portrait.width, landscape.height);
  assert.equal(portrait.height, landscape.width);

  assert.match(pdfSource, /const backgroundColor = getComputedStyle\(element\)\.backgroundColor \|\| "#fbf8f0"/);
  assert.match(pdfSource, /backgroundColor,/);
  assert.match(pdfSource, /page\.drawImage\(image, \{ x: 0, y: 0, width: pageSize\.width, height: pageSize\.height \}\)/);
});

test("iOS printing goes through a rendered PDF instead of the broken page print path", () => {
  assert.match(pdfSource, /iPhone\|iPad\|iPod/);
  assert.match(pdfSource, /if \(isIOSWebKit\(\)\) await toPng\(element, options\);/);
  assert.match(memoryPage, /createAlbumPdf\(page, resolvedAppearance\.orientation\)/);
  assert.match(memoryPage, /navigator\.share\(shareData\)/);
  assert.match(memoryPage, /共有して印刷/);
  assert.doesNotMatch(memoryPage, /window\.print\(\)/);
  assert.equal(getAlbumPdfFilename("2026-09-03"), "memorimber-2026-09-03-l-size.pdf");
  assert.equal(getAlbumPdfFilename("not-a-date"), "memorimber-memory-l-size.pdf");
});
