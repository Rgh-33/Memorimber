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

  assert.match(memoryPage, /style\.textContent\s*=\s*`@page \{ size: \$\{width\}mm \$\{height\}mm; margin: 0; \}`/);
  assert.match(memoryPage, /orientation === "landscape" \? \[127, 89\] : \[89, 127\]/);
  assert.match(memoryPage, /applyAlbumPrintPageSize\(resolvedAppearance\.orientation\)/);

  assert.match(css, /\.memory-detail-page \.memory-book-page\.album-orientation-portrait\s*\{[^}]*width:\s*89mm;[^}]*height:\s*127mm;/s);
  assert.match(css, /\.memory-detail-page \.memory-book-page\.album-orientation-landscape\s*\{[^}]*width:\s*127mm;[^}]*height:\s*89mm;/s);
  assert.match(css, /html\[data-album-print-orientation="portrait"\][\s\S]*?width:\s*89mm\s*!important;[\s\S]*?height:\s*127mm\s*!important;/);
  assert.match(css, /html\[data-album-print-orientation="landscape"\][\s\S]*?width:\s*127mm\s*!important;[\s\S]*?height:\s*89mm\s*!important;/);
  assert.doesNotMatch(css, /size:\s*A4/i);
});
