import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  BACKFILL_THUMBNAIL_SIZE,
  BACKFILL_THUMBNAIL_TARGET_BYTES,
  backfillMemoryRow,
  createBackfillThumbnail,
  getBackfillThumbnailPath,
} from "../scripts/backfill-memory-thumbnails.mjs";

const MEMORY_ID = "40000000-0000-4000-8000-000000000004";
const USER_ID = "20000000-0000-4000-8000-000000000002";

test("backfill produces a compact 110 by 110 WebP", async () => {
  const source = await sharp({
    create: { width: 1200, height: 600, channels: 3, background: { r: 190, g: 70, b: 30 } },
  }).png().toBuffer();
  const thumbnail = await createBackfillThumbnail(source);
  const metadata = await sharp(thumbnail).metadata();
  assert.equal(metadata.width, BACKFILL_THUMBNAIL_SIZE);
  assert.equal(metadata.height, BACKFILL_THUMBNAIL_SIZE);
  assert.equal(metadata.format, "webp");
  assert.ok(thumbnail.byteLength <= BACKFILL_THUMBNAIL_TARGET_BYTES);
});

test("active and retained memories receive constraint-compatible paths", () => {
  assert.equal(getBackfillThumbnailPath({
    id: MEMORY_ID,
    user_id: USER_ID,
    image_path: `${USER_ID}/${MEMORY_ID}.jpg`,
  }), `${USER_ID}/thumbnails/${MEMORY_ID}-110x110.webp`);
  assert.equal(getBackfillThumbnailPath({
    id: MEMORY_ID,
    user_id: null,
    image_path: `retained/${MEMORY_ID}/original.jpg`,
  }), `retained/${MEMORY_ID}/thumbnails/preview.webp`);
  assert.throws(() => getBackfillThumbnailPath({
    id: MEMORY_ID,
    user_id: USER_ID,
    image_path: `${USER_ID}/../another-object.jpg`,
  }), /unsafe owner path/);
});

function backfillClient({ original, previous, updateError = null }) {
  const actions = [];
  const client = {
    storage: {
      from(bucket) {
        assert.equal(bucket, "memory-images");
        return {
          async download(path) {
            const bytes = path.includes("/thumbnails/") ? previous : original;
            return bytes
              ? { data: new Blob([bytes]), error: null }
              : { data: null, error: { message: "missing" } };
          },
          async upload(path, bytes, options) {
            actions.push(["upload", path, bytes.byteLength, options]);
            return { data: { path }, error: null };
          },
          async remove(paths) {
            actions.push(["remove", paths]);
            return { data: paths, error: null };
          },
        };
      },
    },
    from(table) {
      assert.equal(table, "memories");
      return {
        update(value) { actions.push(["update", value]); return this; },
        eq() { return this; },
        is() { return this; },
        select() { return this; },
        async maybeSingle() {
          return updateError ? { data: null, error: { message: updateError } } : { data: { id: MEMORY_ID }, error: null };
        },
      };
    },
  };
  return { client, actions };
}

test("backfill switches the DB path before removing the old thumbnail", async () => {
  const original = await sharp({
    create: { width: 300, height: 180, channels: 3, background: { r: 40, g: 120, b: 180 } },
  }).jpeg().toBuffer();
  const previous = await sharp(original).resize(200, 120).webp().toBuffer();
  const row = {
    id: MEMORY_ID,
    user_id: USER_ID,
    image_path: `${USER_ID}/${MEMORY_ID}.jpg`,
    thumbnail_path: `${USER_ID}/thumbnails/${MEMORY_ID}.webp`,
  };
  const { client, actions } = backfillClient({ original, previous });
  const result = await backfillMemoryRow(client, row);
  assert.equal(result.status, "updated");
  assert.equal(result.usedFallback, false);
  assert.deepEqual(actions.map(([action]) => action), ["upload", "update", "remove"]);
  assert.equal(actions[0][1], `${USER_ID}/thumbnails/${MEMORY_ID}-110x110.webp`);
  assert.equal(actions[1][1].thumbnail_path, actions[0][1]);
  assert.deepEqual(actions[2][1], [row.thumbnail_path]);
});

test("an undecodable original falls back to the old thumbnail without deleting it on DB failure", async () => {
  const previous = await sharp({
    create: { width: 200, height: 150, channels: 3, background: { r: 80, g: 160, b: 60 } },
  }).webp().toBuffer();
  const row = {
    id: MEMORY_ID,
    user_id: USER_ID,
    image_path: `${USER_ID}/${MEMORY_ID}.heic`,
    thumbnail_path: `${USER_ID}/thumbnails/${MEMORY_ID}.webp`,
  };
  const { client, actions } = backfillClient({ original: Buffer.from("not-decodable"), previous, updateError: "rejected" });
  await assert.rejects(backfillMemoryRow(client, row), /Database update failed/);
  assert.deepEqual(actions.map(([action]) => action), ["upload", "update"]);
});
