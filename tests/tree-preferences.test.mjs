import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TREE_DISPLAY_MODE,
  parseTreeDisplayMode,
  TREE_DISPLAY_MODES,
} from "../lib/tree-preferences.ts";

test("tree display mode defaults to the classic twelve-fruit tree", () => {
  assert.equal(DEFAULT_TREE_DISPLAY_MODE, "classic");
  assert.equal(parseTreeDisplayMode(null), "classic");
  assert.equal(parseTreeDisplayMode("unknown"), "classic");
});

test("both supported tree display modes survive storage parsing", () => {
  assert.deepEqual(TREE_DISPLAY_MODES.map((mode) => mode.id), ["classic", "expanding"]);
  assert.equal(parseTreeDisplayMode("classic"), "classic");
  assert.equal(parseTreeDisplayMode("expanding"), "expanding");
});
