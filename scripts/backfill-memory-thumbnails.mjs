import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const BACKFILL_THUMBNAIL_SIZE = 110;
export const BACKFILL_THUMBNAIL_TARGET_BYTES = 10 * 1024;
export const BACKFILL_THUMBNAIL_SUFFIX = "-110x110";

const BUCKET = "memory-images";
const PAGE_SIZE = 100;
const CONCURRENCY = 3;
const WEBP_QUALITIES = [65, 50, 40, 30];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "unknown error");
}

export function getBackfillThumbnailPath(row) {
  if (!UUID_PATTERN.test(row.id)) throw new Error("Invalid memory id");
  if (row.user_id) {
    if (!UUID_PATTERN.test(row.user_id)
      || !new RegExp(`^${row.user_id}/${row.id}\\.[A-Za-z0-9]+$`).test(row.image_path)) {
      throw new Error("Active memory has an unsafe owner path");
    }
    return `${row.user_id}/thumbnails/${row.id}${BACKFILL_THUMBNAIL_SUFFIX}.webp`;
  }
  if (!new RegExp(`^retained/${row.id}/original\\.[A-Za-z0-9]+$`).test(row.image_path)) {
    throw new Error("Retained memory has an unsafe original path");
  }
  return `retained/${row.id}/thumbnails/preview.webp`;
}

function isSafeExistingThumbnailPath(row) {
  if (!row.thumbnail_path) return true;
  if (row.user_id) {
    return new RegExp(`^${row.user_id}/thumbnails/${row.id}(?:${BACKFILL_THUMBNAIL_SUFFIX})?\\.(webp|jpg)$`)
      .test(row.thumbnail_path);
  }
  return new RegExp(`^retained/${row.id}/thumbnails/preview\\.[A-Za-z0-9]+$`).test(row.thumbnail_path);
}

export async function createBackfillThumbnail(input, sharpFactory = sharp) {
  let smallest = null;
  for (const quality of WEBP_QUALITIES) {
    const output = await sharpFactory(input)
      .rotate()
      .resize(BACKFILL_THUMBNAIL_SIZE, BACKFILL_THUMBNAIL_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality, effort: 6 })
      .toBuffer();
    smallest = output;
    if (output.byteLength <= BACKFILL_THUMBNAIL_TARGET_BYTES) break;
  }
  if (!smallest) throw new Error("Thumbnail encoding produced no output");
  return smallest;
}

async function downloadObject(client, path) {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${errorMessage(error)}`);
  return Buffer.from(await data.arrayBuffer());
}

async function updateThumbnailPath(client, row, targetPath) {
  let query = client.from("memories").update({ thumbnail_path: targetPath })
    .eq("id", row.id).eq("image_path", row.image_path);
  query = row.thumbnail_path ? query.eq("thumbnail_path", row.thumbnail_path) : query.is("thumbnail_path", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(`Database update failed: ${errorMessage(error)}`);
  if (!data) throw new Error("Memory changed during backfill; retry the current state");
}

export async function backfillMemoryRow(client, row, { dryRun = false } = {}) {
  const targetPath = getBackfillThumbnailPath(row);
  if (!isSafeExistingThumbnailPath(row)) throw new Error("Memory has an unsafe thumbnail path");
  if (row.user_id && row.thumbnail_path === targetPath) {
    return { status: "skipped", previousBytes: 0, newBytes: 0, sourceBytes: 0, usedFallback: false };
  }
  if (dryRun) {
    return { status: "planned", previousBytes: 0, newBytes: 0, sourceBytes: 0, usedFallback: false };
  }

  let previousThumbnail = null;
  if (row.thumbnail_path) {
    try { previousThumbnail = await downloadObject(client, row.thumbnail_path); }
    catch { /* An absent old derivative must not block rebuilding from the original. */ }
  }

  let sourceBytes = 0;
  let usedFallback = false;
  let thumbnail;
  try {
    const original = await downloadObject(client, row.image_path);
    sourceBytes = original.byteLength;
    thumbnail = await createBackfillThumbnail(original);
  } catch (originalError) {
    if (!previousThumbnail) throw originalError;
    usedFallback = true;
    thumbnail = await createBackfillThumbnail(previousThumbnail);
  }

  const { error: uploadError } = await client.storage.from(BUCKET).upload(targetPath, thumbnail, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true,
    metadata: { thumbnailVariant: "110x110-v2" },
  });
  if (uploadError) throw new Error(`Storage upload failed: ${errorMessage(uploadError)}`);

  await updateThumbnailPath(client, row, targetPath);

  let cleanupWarning = null;
  if (row.thumbnail_path && row.thumbnail_path !== targetPath) {
    const { error: removeError } = await client.storage.from(BUCKET).remove([row.thumbnail_path]);
    if (removeError) cleanupWarning = `Old thumbnail cleanup failed: ${errorMessage(removeError)}`;
  }

  return {
    status: "updated",
    previousBytes: previousThumbnail?.byteLength ?? 0,
    newBytes: thumbnail.byteLength,
    sourceBytes,
    usedFallback,
    cleanupWarning,
  };
}

async function loadAllMemories(client) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("memories")
      .select("id, user_id, image_path, thumbnail_path")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Memory list failed: ${errorMessage(error)}`);
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function run() {
    for (;;) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return results;
}

export async function runBackfill(client, { dryRun }) {
  const rows = await loadAllMemories(client);
  const results = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    try {
      return { id: row.id, ...(await backfillMemoryRow(client, row, { dryRun })) };
    } catch (error) {
      return { id: row.id, status: "failed", error: errorMessage(error), previousBytes: 0, newBytes: 0, sourceBytes: 0 };
    }
  });
  return {
    total: rows.length,
    planned: results.filter((result) => result.status === "planned").length,
    updated: results.filter((result) => result.status === "updated").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    fallback: results.filter((result) => result.usedFallback).length,
    cleanupWarnings: results.filter((result) => result.cleanupWarning).length,
    previousThumbnailBytes: results.reduce((total, result) => total + result.previousBytes, 0),
    newThumbnailBytes: results.reduce((total, result) => total + result.newBytes, 0),
    downloadedOriginalBytes: results.reduce((total, result) => total + result.sourceBytes, 0),
    failures: results.filter((result) => result.status === "failed").map(({ id, error }) => ({ id, error })),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run") || !apply;
  if (apply && process.argv.includes("--dry-run")) throw new Error("Choose either --dry-run or --apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  const client = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await runBackfill(client, { dryRun });
  console.log(JSON.stringify({
    mode: dryRun ? "dry-run" : "apply",
    ...summary,
    previousThumbnailSize: formatBytes(summary.previousThumbnailBytes),
    newThumbnailSize: formatBytes(summary.newThumbnailBytes),
    downloadedOriginalSize: formatBytes(summary.downloadedOriginalBytes),
  }, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) main().catch((error) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
