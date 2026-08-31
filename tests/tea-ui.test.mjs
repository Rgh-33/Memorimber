import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { getTeaCupGeometry } from "../lib/tea-cup-geometry.ts";
import { projectWordmarkPoint, WORDMARK_STRIPS, WORDMARK_WIDTH } from "../lib/tea-wordmark-geometry.ts";
import { getPearlAppearance, MAX_VISIBLE_PEARLS } from "../lib/tea-pearl-layout.ts";

function source(path) {
  return ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function outsideDialogs(root, visit) {
  if (ts.isJsxElement(root) && root.openingElement.tagName.getText() === "dialog") return;
  visit(root);
  ts.forEachChild(root, (child) => outsideDialogs(child, visit));
}

test("home keeps the original tree-page headings verbatim", () => {
  const labels = [];
  outsideDialogs(source("app/page.tsx"), (node) => {
    if (ts.isJsxText(node) && node.text.trim()) labels.push(node.text.trim());
  });
  assert.deepEqual(labels, ["MEMORIES", "あなたの思い出", "何気ない一日を、未来の自分へ。"]);
});

test("cup scene has no visible extra copy, indicators or CTAs; preview sits below it", () => {
  const elements = [];
  const labels = [];
  let scene;
  outsideDialogs(source("components/memory-tea.tsx"), (node) => {
    if (ts.isJsxElement(node) && node.openingElement.attributes.getText().includes('className="tea-scene"')) scene = node;
    if (ts.isJsxText(node) && node.text.trim()) labels.push(node.text.trim());
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
  });
  assert.deepEqual(labels, []);
  assert.equal(elements.filter((node) => node.tagName.getText() === "button").length, 1);
  assert.ok(!elements.some((node) => ["Link", "progress"].includes(node.tagName.getText())));
  const previews = elements.filter((node) => node.tagName.getText() === "TeaPreviewControls");
  assert.equal(previews.length, 1);
  assert.ok(scene && previews[0].pos >= scene.end, "preview controls belong after, not inside, the cup scene");
  assert.ok(!elements.some((node) => node.attributes.getText().includes('role="progressbar"')));
  const trigger = elements.find((node) => node.tagName.getText() === "button");
  assert.match(trigger.attributes.getText(), /aria-haspopup="dialog"/);
  assert.match(trigger.attributes.getText(), /showModal/);
});

test("plastic cup is decorative inside its tap button; no nested links or counters", () => {
  const elements = [];
  const labels = [];
  const inspect = (node) => {
    if (ts.isJsxText(node) && node.text.trim()) labels.push(node.text.trim());
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node.tagName.getText());
  };
  outsideDialogs(source("components/tea-cup.tsx"), inspect);
  outsideDialogs(source("components/tea-wordmark.tsx"), inspect);
  assert.deepEqual(labels, ["memorimber"]);
  assert.ok(!elements.some((tag) => ["Link", "a", "button"].includes(tag)));
});

test("photo-based liquid reaches the base without a gap and clamps at empty/full", () => {
  assert.equal(getTeaCupGeometry(0).top, 95.6);
  assert.equal(getTeaCupGeometry(1).height, 1);
  assert.ok(Math.abs(getTeaCupGeometry(1).top - 35.4) < 1e-8, "full ice line matches the photograph's front meniscus");
  assert.equal(getTeaCupGeometry(-3).level, 0);
  assert.equal(getTeaCupGeometry(3).level, 1);
  assert.equal(getTeaCupGeometry(NaN).level, 0);
  let previousTop = 0;
  for (let sips = 0; sips <= 15; sips++) {
    const geometry = getTeaCupGeometry(1 - sips / 15);
    assert.ok(geometry.top >= previousTop);
    assert.ok(geometry.top <= 95.6);
    assert.ok(geometry.width >= 38.4 && geometry.width <= 60);
    previousTop = geometry.top;
  }
  // A tapered cup needs more than half its height to hold half its volume.
  assert.ok(getTeaCupGeometry(.5).height > .5);
});

test("ice follows the liquid and remains inside the cup even when empty", () => {
  let previousTop = 0;
  for (let sips = 0; sips <= 15; sips++) {
    const geometry = getTeaCupGeometry(1 - sips / 15);
    assert.ok(geometry.iceTop >= previousTop);
    assert.ok(geometry.iceTop >= 32.2, "ice must stay below the lid");
    assert.ok(geometry.iceTop + geometry.iceDepth <= 95.3 + 1e-8, "ice must not fall below the cup's base");
    assert.ok(geometry.iceWidth < geometry.width);
    assert.equal(geometry.iceWidth, 37, "drinking must not shrink the ice");
    assert.ok(geometry.iceWaterline >= 0 && geometry.iceWaterline <= 100);
    if (geometry.iceTop > 32.2 && geometry.iceTop + geometry.iceDepth < geometry.iceFloor - 1e-8) {
      assert.ok(Math.abs(geometry.iceWaterline - 46) < 1e-8, "the photo's top facets clear the surface while ice floats");
    }
    previousTop = geometry.iceTop;
  }
  assert.equal(getTeaCupGeometry(0).iceWaterline, 100);
  assert.ok(getTeaCupGeometry(0, 14).iceTop < getTeaCupGeometry(0).iceTop, "ice rests on the remaining pearls");
  assert.equal(getTeaCupGeometry(0, NaN).iceFloor, getTeaCupGeometry(0).iceFloor);
});

test("hand-painted gloss is removed and submerged ice has its own occlusion layer", () => {
  const css = readFileSync(new URL("../app/tea.css", import.meta.url), "utf8");
  const cup = readFileSync(new URL("../components/tea-cup.tsx", import.meta.url), "utf8");
  assert.ok(!cup.includes("memory-tea-plastic-gloss.png"));
  assert.ok(!css.includes("memory-tea-pearl-soft.png"));
  assert.match(css, /\.tea-ice-submerged\s*\{[^}]*mask-image: linear-gradient/);
  assert.match(css, /\.tea-ice-emerged\s*\{[^}]*clip-path:/);
});

test("wordmark projects complete glyphs onto the tapered wall instead of rotating letters along an arc", () => {
  const wordmark = readFileSync(new URL("../components/tea-wordmark.tsx", import.meta.url), "utf8");
  assert.match(wordmark, /const id = useId\(\)/);
  assert.ok(!wordmark.includes("textPath"));
  assert.match(wordmark, /matrix\(/);
  assert.match(wordmark, /clipPathUnits="userSpaceOnUse"/);
  const center = projectWordmarkPoint(0, 0);
  assert.deepEqual(center, { x: 0, y: 0 });
  const left = projectWordmarkPoint(-52, 0);
  const right = projectWordmarkPoint(52, 0);
  assert.ok(Math.abs(left.x + right.x) < 1e-8);
  assert.equal(left.y, right.y);
  assert.ok(right.x < 52, "letters foreshorten at the sides");
  assert.ok(right.y < 0 && right.y > -2, "the baseline depth stays subtle at this camera angle");
  assert.ok(projectWordmarkPoint(40, -16).x > projectWordmarkPoint(40, 0).x, "top of a right-hand stem follows the wider cup wall");
});

test("wordmark strips cover the entire typeset word and approximate the same cone continuously", () => {
  assert.equal(WORDMARK_STRIPS[0].left, -WORDMARK_WIDTH / 2);
  for (let index = 0; index < WORDMARK_STRIPS.length; index++) {
    const strip = WORDMARK_STRIPS[index];
    if (index) assert.ok(Math.abs(strip.left - WORDMARK_STRIPS[index - 1].left - WORDMARK_STRIPS[index - 1].width) < 1e-8);
    const [a, b, c, d, e, f] = strip.matrix;
    assert.ok(strip.matrix.every((value) => value === Number(value.toFixed(6))), "stable precision across server and browser engines");
    for (const u of [strip.left, strip.left + strip.width]) {
      for (const v of [-18, 0, 5]) {
        const exact = projectWordmarkPoint(u, v);
        assert.ok(Math.abs(a * u + c * v + e - exact.x) < .02);
        assert.ok(Math.abs(b * u + d * v + f - exact.y) < .02);
      }
    }
  }
  const last = WORDMARK_STRIPS.at(-1);
  assert.ok(Math.abs(last.left + last.width - WORDMARK_WIDTH / 2) < 1e-8);
});

test("pearl photographs keep stable variants and overlap in depth instead of a stamped row", () => {
  const variants = new Set();
  for (let index = 0; index < 24; index++) {
    const id = `tea-preview-${index + 1}`;
    const pearl = getPearlAppearance(id, index % MAX_VISIBLE_PEARLS);
    const moved = getPearlAppearance(id, (index + 1) % MAX_VISIBLE_PEARLS);
    assert.equal(pearl.spriteX, moved.spriteX);
    assert.equal(pearl.spriteY, moved.spriteY);
    assert.equal(pearl.turn, moved.turn);
    variants.add(`${pearl.spriteX},${pearl.spriteY}`);
    assert.ok(pearl.x >= 33 && pearl.x <= 66);
    assert.ok(pearl.y >= 86 && pearl.y <= 94);
    assert.ok(pearl.opacity > .6 && pearl.opacity <= 1);
    assert.equal(pearl.depth, Math.round(pearl.y * 100));
  }
  assert.equal(variants.size, 6);
  assert.equal(MAX_VISIBLE_PEARLS, 14);
  assert.ok(getPearlAppearance("same", 5).opacity < getPearlAppearance("same", 0).opacity);
});

test("opaque edited pearl texture always uses its aligned RGBA silhouette", () => {
  const alpha = readFileSync(new URL("../public/images/memory-tea-pearls-alpha.png", import.meta.url));
  const texture = readFileSync(new URL("../public/images/memory-tea-pearls-muted.png", import.meta.url));
  assert.equal(alpha[25], 6, "PNG mask must contain an alpha channel");
  for (const image of [alpha, texture]) {
    assert.equal(image.readUInt32BE(16), 1536);
    assert.equal(image.readUInt32BE(20), 1024);
  }
  const css = readFileSync(new URL("../app/tea.css", import.meta.url), "utf8");
  const pearl = css.match(/\.tea-pearl\s*\{[^}]+\}/)?.[0] ?? "";
  assert.match(pearl, /background-image: url\('\/images\/memory-tea-pearls-muted.png'\)/);
  assert.match(pearl, /mask-image: url\('\/images\/memory-tea-pearls-alpha.png'\)/);
  assert.match(pearl, /mask-mode: alpha/);
  assert.match(pearl, /background-size: 300% 200%/);
  assert.match(pearl, /mask-size: 300% 200%/);
});
