import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  getMemoryImageType, loadMemories, MAX_MEMORY_IMAGE_BYTES, MEMORY_IMAGE_BUCKET,
  MemorySaveError, readPendingMemoryUpload, recoverMemorySave, saveMemory, validateMemoryInput,
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
          if (state.insertError) return json({ message: state.insertError, code: "23514", details: null, hint: null }, 400);
          rows.set(body.id, { ...body, user_id: state.userId });
          if (state.insertThrowsAfterCommit) throw new TypeError("Response lost after commit");
          return new Response(null, { status: 201 });
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
          return json(body.prefixes.map((name) => ({ name })));
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
  assert.equal(result.userId, USER_ID);
  assert.equal(result.memories[0].id, saved.id);
  assert.equal(result.memories[0].caption, "帰り道の思い出");
  assert.match(result.memories[0].imageUrl, /\/object\/sign\/memory-images\//);
  assert.equal(result.memories[0].imagePath, `${USER_ID}/${saved.id}.jpg`);
  const signRequest = h.calls.find((call) => call.url?.pathname.includes("/object/sign/"));
  assert.equal(signRequest.body.expiresIn, 3600);
  assert.equal(result.warning, null);
});

test("loaded memories preserve upload timestamps for the tapioca FIFO", async () => {
  const h = harness({ rows: [{ id: "old-photo-new-upload", user_id: USER_ID, image_path: `${USER_ID}/photo.jpg`, memory_date: "2020-01-01", created_at: "2026-08-31T12:34:56Z", caption: "昔の写真", people: [], tags: [] }] });
  const result = await loadMemories(h.client);
  assert.equal(result.memories[0].createdAt, "2026-08-31T12:34:56Z");
  assert.equal(result.memories[0].date, "2020-01-01");
  const read = h.calls.find((call) => call.url?.pathname === "/rest/v1/memories");
  assert.match(read.url.searchParams.get("select"), /created_at/);
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
