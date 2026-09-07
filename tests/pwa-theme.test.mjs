import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/pwa-theme-metadata.tsx", import.meta.url), "utf8");
const providers = readFileSync(new URL("../app/providers.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("install metadata follows the selected app theme and color mode", () => {
  assert.match(providers, /<PreferencesProvider>[\s\S]*<PwaThemeMetadata\s*\/>/);
  assert.match(component, /manifest-\$\{variant\}\.webmanifest/);
  assert.match(component, /icon-\$\{variant\}-180\.png/);
  assert.match(component, /BACKGROUND_COLORS\[colorMode\]/);
  assert.match(layout, /manifest-light-blue-light\.webmanifest/);
});

test("every app theme has light and dark sprout install icons", () => {
  for (const theme of ["light-blue", "orange", "blue", "black", "green", "purple"]) {
    for (const mode of ["light", "dark"]) {
      for (const size of [180, 192, 512]) {
        assert.equal(existsSync(new URL(`../public/pwa/icon-${theme}-${mode}-${size}.png`, import.meta.url)), true);
      }
      const manifest = JSON.parse(readFileSync(new URL(`../public/pwa/manifest-${theme}-${mode}.webmanifest`, import.meta.url), "utf8"));
      assert.equal(manifest.name, "Memorimber");
      assert.equal(manifest.icons.length, 2);
      assert.ok(manifest.icons.every((icon) => icon.purpose === "any maskable"));
    }
  }
});
