import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const memoryPage = readFileSync(new URL("../app/memory/[id]/page.tsx", import.meta.url), "utf8");

test("album screen, preview, and print keep the same L-size paper contract", () => {
  assert.match(css, /\.memory-book-page\.album-orientation-portrait\s*\{[^}]*aspect-ratio:\s*89\s*\/\s*127;/s);
  assert.match(css, /\.memory-book-page\.album-orientation-landscape\s*\{[^}]*aspect-ratio:\s*127\s*\/\s*89;/s);

  assert.doesNotMatch(css, /@page\s+memory-album/);
  assert.doesNotMatch(css, /page:\s*memory-album/);

  assert.doesNotMatch(memoryPage, /applyAlbumPrintPageSize|window\.print/);
  assert.match(memoryPage, /createAlbumPdf\(page, resolvedAppearance\.orientation\)/);

  assert.match(css, /\.memory-detail-page \.memory-book-page\.album-orientation-portrait\s*\{[^}]*width:\s*89mm;[^}]*height:\s*127mm;/s);
  assert.match(css, /\.memory-detail-page \.memory-book-page\.album-orientation-landscape\s*\{[^}]*width:\s*127mm;[^}]*height:\s*89mm;/s);
  assert.match(css, /html\[data-album-print-orientation="portrait"\][\s\S]*?width:\s*89mm\s*!important;[\s\S]*?height:\s*127mm\s*!important;/);
  assert.match(css, /html\[data-album-print-orientation="landscape"\][\s\S]*?width:\s*127mm\s*!important;[\s\S]*?height:\s*89mm\s*!important;/);
  assert.doesNotMatch(css, /size:\s*A4/i);
});


test("monthly L-size pages keep six photos and a one-line caption", () => {
  const monthlyCss = readFileSync(new URL("../app/album/print-preview/monthly-print.css", import.meta.url), "utf8");
  const monthly = readFileSync(new URL("../components/monthly-album-print-preview.tsx", import.meta.url), "utf8");
  assert.match(monthlyCss, /aspect-ratio: 89 \/ 127/);
  assert.match(monthlyCss, /aspect-ratio: 127 \/ 89/);
  assert.match(monthlyCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(monthlyCss, /\.monthly-caption-slot p \{[^}]*white-space: nowrap/);
  assert.doesNotMatch(monthlyCss, /text-overflow: ellipsis|line-clamp/);
  assert.match(monthly, /memories\.slice\(\(index - 1\) \* 6, index \* 6\)/);
  assert.match(monthly, /createAlbumPagesPdf\(pages, appearance\.orientation\)/);
  assert.match(monthly, /createAlbumPng\(page, appearance\.orientation\)/);
  assert.doesNotMatch(monthly, /window\.print/);
  assert.doesNotMatch(monthlyCss, /@page|@media print|A4/);
});
