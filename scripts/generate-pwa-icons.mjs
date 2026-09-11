import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Sprout } from "lucide-react";

const outputDirectory = path.join(process.cwd(), "public", "pwa");
const themes = {
  "light-blue": { light: "#4a90e2", dark: "#52b9ff" },
  orange: { light: "#e88444", dark: "#ef8944" },
  blue: { light: "#2868bd", dark: "#5c89ff" },
  black: { light: "#24272b", dark: "#cfdceb" },
  green: { light: "#3f9169", dark: "#49dc8f" },
  purple: { light: "#8262bd", dark: "#b882ff" },
};

const modes = {
  light: { background: "#edf5fd", paper: "#ffffff" },
  dark: { background: "#11161c", paper: "#212831" },
};

function iconSvg(size, accent, background, paper) {
  const scale = size / 24;
  const strokeWidth = 1.8 * scale;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${background}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.34}" fill="${paper}"/>
      <g transform="scale(${scale})" fill="none" stroke="${accent}" stroke-width="${strokeWidth / scale}" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 20h10"/>
        <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/>
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
      </g>
    </svg>`;
}

await mkdir(outputDirectory, { recursive: true });

for (const [theme, accents] of Object.entries(themes)) {
  for (const [mode, palette] of Object.entries(modes)) {
    const variant = `${theme}-${mode}`;
    const accent = accents[mode];
    for (const size of [180, 192, 512]) {
      await sharp(Buffer.from(iconSvg(size, accent, palette.background, palette.paper)))
        .png()
        .toFile(path.join(outputDirectory, `icon-${variant}-${size}.png`));
    }
    const manifest = {
      id: "/",
      name: "Memorimber",
      short_name: "Memorimber",
      description: "写真1枚と一言で、日常の思い出を残すWebアプリ",
      lang: "ja",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: palette.background,
      theme_color: palette.background,
      icons: [192, 512].map((size) => ({
        src: `/pwa/icon-${variant}-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any maskable",
      })),
    };
    await writeFile(
      path.join(outputDirectory, `manifest-${variant}.webmanifest`),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  }
}

// Reuse the header's Sprout mark, stroke width, and default theme.
const mark = renderToStaticMarkup(createElement(Sprout, { size: 300, color: "#4a90e2", strokeWidth: 1.8 }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#ffffff"/><g transform="translate(106 106)">${mark}</g></svg>`;
await mkdir(new URL("../public/pwa/", import.meta.url), { recursive: true });
for (const size of [192, 512]) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(`../public/pwa/icon-${size}.png`, import.meta.url).pathname);
