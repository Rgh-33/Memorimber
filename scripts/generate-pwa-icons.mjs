import { mkdir } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sprout } from "lucide-react";
import sharp from "sharp";

// Reuse the header's Sprout mark, stroke width, and default theme.
const mark = renderToStaticMarkup(createElement(Sprout, { size: 300, color: "#4a90e2", strokeWidth: 1.8 }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/><g transform="translate(106 106)">${mark}</g></svg>`;
await mkdir(new URL("../public/pwa/", import.meta.url), { recursive: true });
for (const size of [192, 512]) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(`../public/pwa/icon-${size}.png`, import.meta.url).pathname);
