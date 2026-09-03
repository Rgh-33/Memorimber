import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  deleteMemory, getMemoryImageType, loadMemories, loadMemoryDetail, MAX_MEMORY_IMAGE_BYTES,
  MEMORY_IMAGE_BUCKET, MemoryNotFoundError, MemorySaveError, readPendingMemoryUpload,
  recoverMemorySave, saveMemory, updateMemory, validateMemoryFields, validateMemoryInput,
} from "../lib/supabase/memories.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const makeInput = (changes = {}) => ({
  image: new File(["test photo bytes"], "写真.jpg", { type: "image/jpeg" }),
  caption: " 帰り道の思い出 ", date: "2026-08-31", people: ["友達", " 家族 ", "友達"], tags: ["帰り道"],
  ...changes,
});
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});

function disableCryptoMethod(t, name) {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, name);
  Object.defineProperty(crypto, name, { configurable: true, value: undefined });
  t.after(() => {
    if (descriptor) Object.defineProperty(crypto, name, descriptor);
    else delete crypto[name];
  });
}

// Real supabase-js request serialization, with an entirely in-memory transport.
// This does NOT claim to test the deployed Supabase RLS or bucket configuration.
function harness(options = {}) {
  const calls = [];
  const objects = new Map();
  const rows = new Map((options.rows ?? []).map((row) => [row.id, row]));
  const state = { userId: USER_ID, ...options };
  const client = createClient("https://memory-tests.invalid", "public-test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (url, init) => {
        const parsed = new URL(url);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
        calls.push({ url: parsed, method, body, headers: new Headers(init?.headers) });
        if (parsed.pathname.startsWith(`/storage/v1/object/${MEMORY_IMAGE_BUCKET}/`) && method === "POST") {
          if (state.uploadThrows) throw new TypeError("Network failed during upload");
          if (state.uploadError) return json({ message: state.uploadError, statusCode: "413", error: "Payload too large" }, 413);
          const path = decodeURIComponent(parsed.pathname.split(`/object/${MEMORY_IMAGE_BUCKET}/`)[1]);
          objects.set(path, body.get(""));
          return json({ Key: `${MEMORY_IMAGE_BUCKET}/${path}`, Id: "storage-id" });
        }
        if (parsed.pathname === "/rest/v1/memories" && method === "POST") {
          if (state.insertThrowsBeforeCommit) throw new TypeError("Network failed before response");
          if (state.restoreError && body.id === state.lastDeletedId) {
            return json({ message: state.restoreError, code: "23514", details: null, hint: null }, 400);
          }
          if (state.insertError) return json({ message: state.insertError, code: "23514", details: null, hint: null }, 400);
          rows.set(body.id, { ...body, user_id: state.userId });
          if (state.insertThrowsAfterCommit) throw new TypeError("Response lost after commit");
          return new Response(null, { status: 201 });
        }
        if (parsed.pathname === "/rest/v1/memories" && method === "PATCH") {
          if (state.updateError) return json({ message: state.updateError, code: "42501", details: null, hint: null }, 403);
          const userId = parsed.searchParams.get("user_id")?.slice(3);
          const id = parsed.searchParams.get("id")?.slice(3);
          const row = rows.get(id);
          if (!row || row.user_id !== userId) return json([]);
          const updated = { ...row, ...body, updated_at: "2026-09-02T12:00:00.000Z" };
          rows.set(id, updated);
          return json([updated]);
        }
        if (parsed.pathname === "/rest/v1/memories" && method === "DELETE") {
          if (state.deleteError) return json({ message: state.deleteError, code: "42501", details: null, hint: null }, 403);
          const userId = parsed.searchParams.get("user_id")?.slice(3);
          const id = parsed.searchParams.get("id")?.slice(3);
          const row = rows.get(id);
          if (!row || row.user_id !== userId) return json([]);
          rows.delete(id);
          state.lastDeletedId = id;
          if (state.deleteThrowsAfterCommit) throw new TypeError("Delete response lost after commit");
          return json([{ id }]);
        }
        if (parsed.pathname === "/rest/v1/memories" && method === "GET") {
          if (state.readError) return json({ message: "Read failed", code: "42501" }, 403);
          let matching = [...rows.values()].filter((row) => `eq.${row.user_id}` === parsed.searchParams.get("user_id"));
          const id = parsed.searchParams.get("id");
          if (id) matching = matching.filter((row) => `eq.${row.id}` === id);
          const offset = Number(parsed.searchParams.get("offset") ?? 0);
          const limit = Number(parsed.searchParams.get("limit") ?? matching.length);
          return json(matching.slice(offset, offset + limit));
        }
        if (parsed.pathname === `/storage/v1/object/${MEMORY_IMAGE_BUCKET}` && method === "DELETE") {
          if (state.removeError) return json({ message: "Delete denied", statusCode: "403", error: "Forbidden" }, 403);
          for (const path of body.prefixes) objects.delete(path);
          if (state.removeThrowsAfterCommit) throw new TypeError("Storage delete response lost after commit");
          return json(body.prefixes.map((name) => ({ name })));
        }
        if (parsed.pathname === `/storage/v1/object/list/${MEMORY_IMAGE_BUCKET}` && method === "POST") {
          const prefix = body.prefix ? `${body.prefix}/` : "";
          return json([...objects.keys()]
            .filter((path) => path.startsWith(prefix))
            .map((path) => ({ name: path.slice(prefix.length) }))
            .filter((item) => !body.search || item.name.includes(body.search)));
        }
        if (parsed.pathname === `/storage/v1/object/sign/${MEMORY_IMAGE_BUCKET}` && method === "POST") {
          if (state.signError) return json({ message: "Sign denied", statusCode: "403", error: "Forbidden" }, 403);
          return json(body.paths.map((path) => ({ path, signedURL: `/object/sign/${MEMORY_IMAGE_BUCKET}/${path}?token=mock`, error: null })));
        }
        throw new Error(`Unexpected request: ${method} ${parsed.pathname}`);
      },
    },
  });
  client.auth.getUser = async () => {
    calls.push({ method: "AUTH" });
    return { data: { user: state.userId ? { id: state.userId } : null }, error: null };
  };
  return { client, calls, objects, rows, state };
}

for (const [extension, mime] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"], ["heic", "image/heic"], ["heif", "image/heif"]]) {
  test(`${extension}: original bytes and MIME survive upload; owner folder matches DB path`, async () => {
    const h = harness();
    const stages = [];
    const input = makeInput({ image: new File(["unchanged bytes"], `写真.${extension}`, { type: mime }) });
    const result = await saveMemory(h.client, input, (stage) => stages.push(stage));
    const path = `${USER_ID}/${result.id}.${extension}`;
    assert.match(result.id, /^[0-9a-f-]{36}$/);
    assert.equal(h.objects.size, 1);
    assert.equal(h.rows.size, 1);
    assert.equal(h.rows.get(result.id).image_path, path);
    assert.equal(h.objects.get(path).type, mime);
    assert.equal(await h.objects.get(path).text(), "unchanged bytes");
    const insert = h.calls.find((call) => call.method === "POST" && call.url.pathname === "/rest/v1/memories");
    assert.deepEqual(Object.keys(insert.body).sort(), ["id", "image_path", "caption", "memory_date", "people", "tags"].sort());
    assert.equal(insert.body.caption, "帰り道の思い出");
    assert.equal(insert.body.memory_date, "2026-08-31");
    assert.deepEqual(insert.body.people, ["友達", "家族"]);
    assert.deepEqual(insert.body.tags, ["帰り道"]);
    const upload = h.calls.find((call) => call.body instanceof FormData);
    assert.equal(upload.headers.get("x-upsert"), "false");
    assert.deepEqual(stages, ["auth", "upload", "insert"]);
  });
}

test("iPhone HEIC/HEIF with empty MIME uses extension and correct multipart MIME", async () => {
  for (const extension of ["HEIC", "HEIF"]) {
    const h = harness();
    await saveMemory(h.client, makeInput({ image: new File(["original"], `IMG_0001.${extension}`) }));
    assert.equal([...h.objects.values()][0].type, `image/${extension.toLowerCase()}`);
  }
});

test("rejects empty, unsupported, and oversized files before any auth/upload/insert", async () => {
  const h = harness();
  for (const image of [new File([], "empty.jpg", { type: "image/jpeg" }), new File(["gif"], "a.gif", { type: "image/gif" })]) {
    await assert.rejects(saveMemory(h.client, makeInput({ image })));
  }
  assert.throws(() => getMemoryImageType({ name: "large.png", type: "image/png", size: MAX_MEMORY_IMAGE_BYTES + 1 }), /20MB/);
  assert.equal(getMemoryImageType({ name: "exact.png", type: "image/png", size: MAX_MEMORY_IMAGE_BYTES }).extension, "png");
  assert.equal(h.calls.length, 0);
});

test("validates caption/date; people/tags remain string arrays", () => {
  for (const date of ["", "invalid", "2026-02-30", "2026-13-01"]) assert.throws(() => validateMemoryInput(makeInput({ date })), /日付/);
  for (const caption of [" ", "あ".repeat(81)]) assert.throws(() => validateMemoryInput(makeInput({ caption })), /80文字/);
  assert.deepEqual(validateMemoryInput(makeInput({ people: [], tags: [] })).fields.tags, []);
  assert.equal(validateMemoryInput(makeInput({ date: "2024-02-29" })).fields.memory_date, "2024-02-29");
  assert.deepEqual(validateMemoryFields({ caption: " 編集後 ", date: "2026-09-02", people: ["友達", "友達"], tags: [" 放課後 "] }), {
    caption: "編集後", memory_date: "2026-09-02", people: ["友達"], tags: ["放課後"],
  });
});

test("unauthenticated users cannot upload or insert", async () => {
  const h = harness({ userId: null });
  await assert.rejects(saveMemory(h.client, makeInput()), /ログイン/);
  assert.deepEqual(h.calls.map((call) => call.method), ["AUTH"]);
});

test("Storage rejection is explained and prevents DB INSERT", async () => {
  const h = harness({ uploadError: "Maximum allowed size exceeded" });
  await assert.rejects(saveMemory(h.client, makeInput()), /Maximum allowed size exceeded/);
  assert.equal(h.calls.filter((call) => call.url?.pathname === "/rest/v1/memories").length, 0);
  assert.equal(h.objects.size, 0);
});

test("transport failure during upload never inserts; retry metadata is retained for cleanup", async () => {
  const h = harness({ uploadThrows: true });
  let pending;
  await assert.rejects(saveMemory(h.client, makeInput()), (error) => { pending = error.pending; return Boolean(pending); });
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
  assert.equal((await recoverMemorySave(h.client, pending)).saved, false);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 1);
  assert.equal(h.rows.size, 0);
});

test("DB rejection deletes exactly the just-uploaded object", async () => {
  const h = harness({ insertError: "caption check failed" });
  h.objects.set(`${USER_ID}/existing.jpg`, new File(["keep"], "existing.jpg"));
  await assert.rejects(saveMemory(h.client, makeInput()), /画像は取り消しました/);
  assert.equal(h.rows.size, 0);
  assert.deepEqual([...h.objects.keys()], [`${USER_ID}/existing.jpg`]);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 1);
});

test("rollback error keeps the pending attempt and can be retried without another INSERT", async () => {
  const h = harness({ insertError: "DB rejected", removeError: true });
  let pending;
  await assert.rejects(saveMemory(h.client, makeInput()), (error) => {
    assert.ok(error instanceof MemorySaveError);
    assert.match(error.message, /Delete denied/);
    pending = error.pending;
    return Boolean(pending);
  });
  assert.equal(h.objects.size, 1);
  h.state.removeError = false;
  assert.deepEqual(await recoverMemorySave(h.client, pending), { saved: false, id: pending.id });
  assert.equal(h.objects.size, 0);
  assert.equal(h.calls.filter((call) => call.method === "POST" && call.url.pathname === "/rest/v1/memories").length, 1);
});

test("lost INSERT response is reconciled; a committed photo is never deleted", async () => {
  const h = harness({ insertThrowsAfterCommit: true });
  const result = await saveMemory(h.client, makeInput());
  assert.ok(h.rows.has(result.id));
  assert.equal(h.objects.size, 1);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
});

test("uncertain INSERT is not deleted immediately; manual recheck cleans up the fixed ID", async () => {
  const h = harness({ insertThrowsBeforeCommit: true });
  let pending;
  await assert.rejects(saveMemory(h.client, makeInput()), (error) => { pending = error.pending; return Boolean(pending); });
  assert.equal(h.objects.size, 1);
  await recoverMemorySave(h.client, pending);
  assert.equal(h.objects.size, 0);
  assert.equal(h.rows.size, 0);
  assert.ok(h.calls.some((call) => call.url?.searchParams.has("id")));
});

test("unknown INSERT outcome with failed verification preserves photo and pending recovery", async () => {
  const h = harness({ insertThrowsAfterCommit: true, readError: true });
  await assert.rejects(saveMemory(h.client, makeInput()), (error) => Boolean(error.pending) && /保存結果/.test(error.message));
  assert.equal(h.objects.size, 1);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
});

test("recovery refuses another user's path and carries pending state through auth expiry", async () => {
  const h = harness();
  const pending = { userId: OTHER_USER_ID, id: crypto.randomUUID(), imagePath: `${OTHER_USER_ID}/photo.jpg` };
  await assert.rejects(recoverMemorySave(h.client, pending), /アカウント/);
  assert.equal(h.calls.length, 1);
  h.state.userId = null;
  await assert.rejects(recoverMemorySave(h.client, pending), (error) => error.pending === pending);
});

test("save then reload reads durable rows and private signed URLs; other owners are scoped out", async () => {
  const h = harness({ rows: [{ id: "other", user_id: OTHER_USER_ID, image_path: `${OTHER_USER_ID}/photo.jpg` }] });
  const saved = await saveMemory(h.client, makeInput());
  const result = await loadMemories(h.client);
  assert.equal(result.memories.length, 1);
  assert.equal(result.memories[0].id, saved.id);
  assert.equal(result.memories[0].caption, "帰り道の思い出");
  assert.match(result.memories[0].imageUrl, /\/object\/sign\/memory-images\//);
  assert.equal(result.memories[0].imagePath, `${USER_ID}/${saved.id}.jpg`);
  const signRequest = h.calls.find((call) => call.url?.pathname.includes("/object/sign/"));
  assert.equal(signRequest.body.expiresIn, 3600);
  assert.equal(result.warning, null);
});

test("signed-URL failure still returns saved metadata with a warning", async () => {
  const h = harness({ signError: true });
  await saveMemory(h.client, makeInput());
  const result = await loadMemories(h.client);
  assert.equal(result.memories.length, 1);
  assert.equal(result.memories[0].imageUrl, "");
  assert.match(result.warning, /写真を読み込めません/);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
});

test("paginated read does not silently stop at the first 100 memories", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({
    id: String(index), user_id: USER_ID, image_path: `${USER_ID}/${index}.jpg`,
    caption: "test", memory_date: "2026-08-31", people: [], tags: [],
  }));
  const h = harness({ rows });
  const result = await loadMemories(h.client);
  assert.equal(result.memories.length, 101);
  assert.equal(h.calls.filter((call) => call.method === "GET").length, 2);
});

test("failed DB read does not become an empty successful album", async () => {
  const h = harness({ readError: true });
  await assert.rejects(loadMemories(h.client), /思い出を読み込めません/);
});

const DETAIL_IDS = {
  earlier: "10000000-0000-4000-8000-000000000001",
  sameEarlier: "10000000-0000-4000-8000-000000000002",
  current: "10000000-0000-4000-8000-000000000003",
  sameLater: "10000000-0000-4000-8000-000000000004",
  other: "20000000-0000-4000-8000-000000000001",
};
const detailRow = (id, changes = {}) => ({
  id, user_id: USER_ID, image_path: `${USER_ID}/${id}.jpg`, caption: "詳細の思い出",
  memory_date: "2026-09-01", people: ["友達"], tags: ["放課後"],
  created_at: "2026-09-01T10:00:00.000Z", updated_at: "2026-09-01T10:00:00.000Z",
  ...changes,
});

test("detail loads one owned URL id, signs its private image, and orders same-day neighbors stably", async () => {
  const rows = [
    detailRow(DETAIL_IDS.sameLater, { created_at: "2026-09-01T11:00:00.000Z" }),
    detailRow(DETAIL_IDS.current),
    detailRow(DETAIL_IDS.earlier, { memory_date: "2026-08-31", created_at: "2026-08-31T18:00:00.000Z" }),
    detailRow(DETAIL_IDS.sameEarlier, { created_at: "2026-09-01T09:00:00.000Z" }),
    detailRow(DETAIL_IDS.other, { user_id: OTHER_USER_ID, image_path: `${OTHER_USER_ID}/${DETAIL_IDS.other}.jpg` }),
  ];
  const h = harness({ rows });
  const result = await loadMemoryDetail(h.client, DETAIL_IDS.current);
  assert.equal(result.memory.id, DETAIL_IDS.current);
  assert.equal(result.memory.caption, "詳細の思い出");
  assert.match(result.memory.imageUrl, /\/object\/sign\/memory-images\//);
  assert.equal(result.previousId, DETAIL_IDS.sameEarlier);
  assert.equal(result.nextId, DETAIL_IDS.sameLater);
  const reads = h.calls.filter((call) => call.method === "GET" && call.url?.pathname === "/rest/v1/memories");
  assert.equal(reads[0].url.searchParams.get("id"), `eq.${DETAIL_IDS.current}`);
  assert.ok(reads.every((call) => call.url.searchParams.get("user_id") === `eq.${USER_ID}`));
  const sign = h.calls.find((call) => call.url?.pathname.includes("/object/sign/"));
  assert.deepEqual(sign.body.paths, [`${USER_ID}/${DETAIL_IDS.current}.jpg`]);
});

test("another owner's or invalid memory id is indistinguishable from not found", async () => {
  const h = harness({ rows: [detailRow(DETAIL_IDS.other, {
    user_id: OTHER_USER_ID, image_path: `${OTHER_USER_ID}/${DETAIL_IDS.other}.jpg`,
  })] });
  assert.equal(await loadMemoryDetail(h.client, DETAIL_IDS.other), null);
  assert.equal(await loadMemoryDetail(h.client, "not-a-uuid"), null);
  await assert.rejects(updateMemory(h.client, DETAIL_IDS.other, {
    caption: "変更", date: "2026-09-02", people: [], tags: [],
  }), MemoryNotFoundError);
  await assert.rejects(deleteMemory(h.client, DETAIL_IDS.other), MemoryNotFoundError);
  assert.equal(h.calls.filter((call) => call.url?.pathname.includes("/object/sign/")).length, 0);
  const attemptedUpdate = h.calls.find((call) => call.method === "PATCH");
  assert.equal(attemptedUpdate.url.searchParams.get("user_id"), `eq.${USER_ID}`);
  assert.equal(h.rows.get(DETAIL_IDS.other).caption, "詳細の思い出");
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
});

test("editing owned fields persists and is visible after a fresh detail load", async () => {
  const h = harness({ rows: [detailRow(DETAIL_IDS.current)] });
  await updateMemory(h.client, DETAIL_IDS.current, {
    caption: " 編集した一言 ", date: "2026-09-02", people: ["友達", " 家族 ", "友達"], tags: ["帰り道"],
  });
  const reloaded = await loadMemoryDetail(h.client, DETAIL_IDS.current);
  assert.equal(reloaded.memory.caption, "編集した一言");
  assert.equal(reloaded.memory.date, "2026-09-02");
  assert.deepEqual(reloaded.memory.people, ["友達", "家族"]);
  assert.deepEqual(reloaded.memory.tags, ["帰り道"]);
  const update = h.calls.find((call) => call.method === "PATCH");
  assert.equal(update.url.searchParams.get("user_id"), `eq.${USER_ID}`);
  assert.equal(update.url.searchParams.get("id"), `eq.${DETAIL_IDS.current}`);
  assert.equal(update.body.image_path, undefined);
});

test("deleting an owned memory removes both its DB row and exact Storage object", async () => {
  const row = detailRow(DETAIL_IDS.current);
  const h = harness({ rows: [row] });
  h.objects.set(row.image_path, new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  assert.deepEqual(await deleteMemory(h.client, DETAIL_IDS.current), { id: DETAIL_IDS.current });
  assert.equal(h.rows.has(DETAIL_IDS.current), false);
  assert.equal(h.objects.has(row.image_path), false);
  const removal = h.calls.find((call) => call.method === "DELETE" && call.url?.pathname.startsWith("/storage/"));
  assert.deepEqual(removal.body.prefixes, [row.image_path]);
});

test("Storage deletion failure restores the captured DB row instead of leaving an orphan image", async () => {
  const row = detailRow(DETAIL_IDS.current);
  const h = harness({ rows: [row], removeError: true });
  h.objects.set(row.image_path, new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  await assert.rejects(deleteMemory(h.client, DETAIL_IDS.current), /元に戻しました/);
  assert.equal(h.rows.get(DETAIL_IDS.current).image_path, row.image_path);
  assert.equal(h.rows.get(DETAIL_IDS.current).caption, row.caption);
  assert.equal(h.objects.has(row.image_path), true);
  assert.equal(h.calls.filter((call) => call.method === "POST" && call.url?.pathname === "/rest/v1/memories").length, 1);
});

test("DB deletion failure leaves the Storage image untouched", async () => {
  const row = detailRow(DETAIL_IDS.current);
  const h = harness({ rows: [row], deleteError: "Delete denied" });
  h.objects.set(row.image_path, new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  await assert.rejects(deleteMemory(h.client, DETAIL_IDS.current), /写真は削除していません/);
  assert.equal(h.rows.has(DETAIL_IDS.current), true);
  assert.equal(h.objects.has(row.image_path), true);
  assert.equal(h.calls.filter((call) => call.url?.pathname.startsWith("/storage/") && call.method === "DELETE").length, 0);
});

test("lost DB delete response is reconciled before cleaning the captured image", async () => {
  const row = detailRow(DETAIL_IDS.current);
  const h = harness({ rows: [row], deleteThrowsAfterCommit: true });
  h.objects.set(row.image_path, new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  assert.deepEqual(await deleteMemory(h.client, DETAIL_IDS.current), { id: DETAIL_IDS.current });
  assert.equal(h.rows.has(DETAIL_IDS.current), false);
  assert.equal(h.objects.has(row.image_path), false);
  assert.ok(h.calls.filter((call) => call.method === "GET" && call.url?.pathname === "/rest/v1/memories").length >= 2);
});

test("lost Storage delete response does not restore a row after the object is confirmed absent", async () => {
  const row = detailRow(DETAIL_IDS.current);
  const h = harness({ rows: [row], removeThrowsAfterCommit: true });
  h.objects.set(row.image_path, new File(["photo"], "photo.jpg", { type: "image/jpeg" }));
  assert.deepEqual(await deleteMemory(h.client, DETAIL_IDS.current), { id: DETAIL_IDS.current });
  assert.equal(h.rows.has(DETAIL_IDS.current), false);
  assert.equal(h.objects.has(row.image_path), false);
  assert.equal(h.calls.filter((call) => call.method === "POST" && call.url?.pathname === "/rest/v1/memories").length, 0);
  assert.ok(h.calls.some((call) => call.url?.pathname === `/storage/v1/object/list/${MEMORY_IMAGE_BUCKET}`));
});

test("recovery metadata is journaled before uploading and survives a tab reload", async () => {
  const h = harness();
  let stored;
  const result = await saveMemory(h.client, makeInput(), undefined, (pending) => {
    assert.equal(h.objects.size, 0);
    stored = JSON.stringify(pending);
  });
  const pending = readPendingMemoryUpload({ getItem: () => stored });
  assert.deepEqual(Object.keys(pending).sort(), ["id", "imagePath", "userId"]);
  assert.deepEqual(await recoverMemorySave(h.client, pending), { saved: true, id: result.id });
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
  assert.equal(readPendingMemoryUpload({ getItem: () => "broken JSON" }), null);
  assert.equal(readPendingMemoryUpload({ getItem: () => JSON.stringify({ ...pending, imagePath: "someone/else.jpg" }) }), null);
});

test("failure to journal recovery information prevents upload", async () => {
  const h = harness();
  await assert.rejects(saveMemory(h.client, makeInput(), undefined, () => { throw new Error("Storage unavailable"); }), /Storage unavailable/);
  assert.deepEqual(h.calls.map((call) => call.method), ["AUTH"]);
});

for (const [byte, expectedId] of [
  [0, "00000000-0000-4000-8000-000000000000"],
  [255, "ffffffff-ffff-4fff-bfff-ffffffffffff"],
]) {
  test(`HTTP LAN: missing randomUUID still saves a valid UUID v4 (byte ${byte})`, async (t) => {
    disableCryptoMethod(t, "randomUUID");
    t.mock.method(crypto, "getRandomValues", function (bytes) {
      assert.equal(this, crypto);
      assert.ok(bytes instanceof Uint8Array);
      assert.equal(bytes.length, 16);
      return bytes.fill(byte);
    });
    const h = harness();
    const saved = await saveMemory(h.client, makeInput());
    assert.equal(saved.id, expectedId);
    assert.equal(h.rows.get(saved.id).image_path, `${USER_ID}/${saved.id}.jpg`);
    assert.ok(h.objects.has(`${USER_ID}/${saved.id}.jpg`));
  });
}

test("HTTP LAN: fallback uses fresh cryptographic randomness, never Math.random", async (t) => {
  disableCryptoMethod(t, "randomUUID");
  t.mock.method(Math, "random", () => { throw new Error("Insecure randomness must not be used"); });
  const h = harness();
  const first = await saveMemory(h.client, makeInput());
  const second = await saveMemory(h.client, makeInput());
  for (const { id } of [first, second]) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first.id, second.id);
  assert.equal(h.objects.size, 2);
  assert.equal(h.rows.size, 2);
});

test("HTTP LAN: missing all secure randomness stops before upload and journaling", async (t) => {
  disableCryptoMethod(t, "randomUUID");
  disableCryptoMethod(t, "getRandomValues");
  const h = harness();
  let journaled = false;
  await assert.rejects(saveMemory(h.client, makeInput(), undefined, () => { journaled = true; }), (error) => {
    assert.ok(error instanceof MemorySaveError);
    assert.match(error.message, /保存用ID/);
    return true;
  });
  assert.equal(journaled, false);
  assert.deepEqual(h.calls.map((call) => call.method), ["AUTH"]);
});

test("HTTP LAN: DB rejection still rolls back the fallback UUID's photo", async (t) => {
  disableCryptoMethod(t, "randomUUID");
  const h = harness({ insertError: "DB rejected" });
  await assert.rejects(saveMemory(h.client, makeInput()), /画像は取り消しました/);
  assert.equal(h.objects.size, 0);
  assert.equal(h.rows.size, 0);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 1);
});

test("HTTP LAN: fallback UUID remains recoverable after a lost INSERT response", async (t) => {
  disableCryptoMethod(t, "randomUUID");
  const h = harness({ insertThrowsAfterCommit: true });
  let stored;
  const saved = await saveMemory(h.client, makeInput(), undefined, (pending) => { stored = JSON.stringify(pending); });
  const pending = readPendingMemoryUpload({ getItem: () => stored });
  assert.equal(pending.id, saved.id);
  assert.deepEqual(await recoverMemorySave(h.client, pending), { saved: true, id: saved.id });
  assert.equal(h.objects.size, 1);
  assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 0);
});
