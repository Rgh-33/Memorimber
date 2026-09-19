import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { reminderDate, reminderPayload, selectMemoryReminder } from "../lib/memory-reminders.ts";
import { buildPersistedTreeItems, buildTreeItems } from "../lib/tree-growth.ts";
import { deliverUserReminder, runMemoryReminders } from "../lib/memory-reminder-runner.ts";
import { parsePushSubscription, validPushEndpoint } from "../lib/push-subscription.ts";

import { defaultNotificationPreferences, parseNotificationPreferences, receivesRemindersOn } from "../lib/notification-preferences.ts";
import { sendTestPush } from "../lib/push-test.ts";

const date = "2026-09-11";
const memory = (id, day, createdAt = `${day}T01:00:00Z`) => ({ id, date: day, createdAt, caption: "private caption", imageUrl: "private signed URL", tags: [], people: [] });
const ready = [{ stage: "quiz-ready" }];
test("JST notification day changes at 15:00 UTC", () => {
  assert.equal(reminderDate(new Date("2026-09-10T14:59:59Z")), "2026-09-10");
  assert.equal(reminderDate(new Date("2026-09-10T15:00:00Z")), "2026-09-11");
});
test("1/2/3 years ago includes both ±7 day endpoints and excludes ±8", () => {
  for (let years = 1; years <= 3; years++) {
    for (const day of ["09-04", "09-11", "09-18"]) {
      const candidate = selectMemoryReminder("u", date, [memory("m", `${2026-years}-${day}`)], []);
      assert.equal(candidate.title, `${years}年前のこの頃`);
      assert.equal(candidate.href, "/memory/m");
      assert.deepEqual(Object.keys(reminderPayload(candidate)), ["title", "body", "href"]);
      assert.doesNotMatch(JSON.stringify(reminderPayload(candidate)), /private/);
    }
    for (const day of ["09-03", "09-19"]) assert.equal(selectMemoryReminder("u", date, [memory("m", `${2026-years}-${day}`)], []), null);
  }
});
test("year boundaries and leap days use calendar windows", () => {
  assert.equal(selectMemoryReminder("u", "2026-01-02", [memory("m", "2024-12-27")], []).title, "1年前のこの頃");
  assert.equal(selectMemoryReminder("u", "2024-02-29", [memory("m", "2023-02-21")], []).title, "1年前のこの頃");
});
test("selection is stable across retries/order and alternates categories when both exist", () => {
  const memories = [memory("b", "2025-09-10"), memory("a", "2025-09-11")];
  const first = selectMemoryReminder("u", date, memories, ready);
  assert.deepEqual(selectMemoryReminder("u", date, [...memories].reverse(), ready), first);
  const next = selectMemoryReminder("u", "2026-09-12", memories, ready);
  assert.notEqual(first.type, next.type);
  assert.equal(selectMemoryReminder("u", date, [], []), null);
});
test("harvest candidates use the same persisted and preview Tree builders", () => {
  const memories = Array.from({ length: 8 }, (_, i) => memory(`m${i}`, "2026-09-10", `2026-09-10T01:00:0${i}Z`));
  assert.equal(selectMemoryReminder("u", date, [], buildPersistedTreeItems(memories, date, {})), null);
  const fruits = { m0: { ripenedAt: "2026-09-10", harvestedAt: null } };
  assert.equal(selectMemoryReminder("u", date, [], buildPersistedTreeItems(memories, date, fruits)).type, "harvest");
  fruits.m0.harvestedAt = "2026-09-11";
  assert.equal(selectMemoryReminder("u", date, [], buildPersistedTreeItems(memories, date, fruits)), null);
  assert.equal(selectMemoryReminder("u", date, [], buildTreeItems(memories, date, {})).type, "harvest");
  assert.equal(selectMemoryReminder("u", "2026-10-01", [], buildPersistedTreeItems(memories, "2026-10-01", {})), null);
});

const subscription = (id, user = "u") => ({ id, user_id: user, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "A".repeat(87), auth: "A".repeat(22) });
function database({ subscriptions = [subscription("s")], memories = [{ id: "m", user_id: "u", memory_date: "2025-09-11", created_at: "2026-09-01T01:00:00Z" }] } = {}) {
  const tables = { push_subscriptions: subscriptions.map(row => ({ ...defaultNotificationPreferences(), ...row })), memories, memory_fruits: [], memory_notification_deliveries: [], push_notification_deliveries: [] };
  const queries = [];
  const client = { from(table) {
    const filters = []; let operation = "select"; let value; let start = 0; let end = Infinity; let single = false;
    const query = {
      select() { return query; }, eq(k, v) { filters.push(row => row[k] === v); queries.push([table,k,v]); return query; },
      in(k, v) { filters.push(row => v.includes(row[k])); return query; }, order() { return query; },
      range(a,b) { start=a; end=b; return query; }, maybeSingle() { single=true; return query; },
      insert(v) { operation="insert"; value=v; return query; }, update(v) { operation="update"; value=v; return query; }, delete() { operation="delete"; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        const matches = tables[table].filter(row => filters.every(filter => filter(row)));
        if (operation === "insert") {
          if (tables[table].some(row => (table === "push_notification_deliveries" ? row.subscription_id === value.subscription_id : row.user_id === value.user_id) && row.notification_date === value.notification_date)) return { error: { code: "23505" }, data: null };
          tables[table].push({ ...value });
        }
        if (operation === "update") matches.forEach(row => Object.assign(row,value));
        if (operation === "delete") tables[table] = tables[table].filter(row => !matches.includes(row));
        return { error: null, data: single ? matches[0] ?? null : matches.slice(start,end+1) };
      }).then(resolve,reject); },
    }; return query;
  } }; return { client, tables, queries };
}
test("concurrent cron and same-day retries claim a single notification", async () => {
  const { client,tables,queries } = database(); let calls=0;
  const send = async () => { calls++; };
  await Promise.all([deliverUserReminder(client,"u",date,[subscription("s")],send),deliverUserReminder(client,"u",date,[subscription("s")],send)]);
  await deliverUserReminder(client,"u",date,[subscription("s")],send);
  assert.equal(calls,1); assert.equal(tables.push_notification_deliveries.length,1);
  assert.equal(tables.push_notification_deliveries[0].status,"sent");
  assert.ok(queries.some(([table,key,value]) => table === "memories" && key === "user_id" && value === "u"));
});
test("another user's memory is never included in the daily fallback", async () => {
  const { client,tables } = database({ memories: [{ id:"other",user_id:"other",memory_date:"2025-09-11" }] });
  const received = [];
  assert.equal(await deliverUserReminder(client,"u",date,[subscription("s")],async (_, payload) => received.push(JSON.parse(payload))),"sent");
  assert.deepEqual(received, [{ title: "メモリンバー", body: "思い出を振り返る時間です。思い出の木を開いてみませんか？", href: "/" }]);
  assert.equal(tables.push_notification_deliveries.length,1);
  assert.equal(tables.push_notification_deliveries[0].notification_type,"daily");
  assert.equal(tables.push_notification_deliveries[0].candidate_id,null);
});
test("404/410 removes only expired subscriptions; temporary errors do not block peers or retry", async () => {
  const subscriptions = [subscription("gone"),subscription("missing"),subscription("temporary"),subscription("ok"),subscription("peer","v")];
  const { client,tables } = database({ subscriptions, memories: [
    { id:"m",user_id:"u",memory_date:"2025-09-11" }, { id:"n",user_id:"v",memory_date:"2025-09-11" },
  ] });
  let calls=0;
  const send=async (sub) => { calls++; const id=sub.endpoint.split("/").at(-1); const code={gone:410,missing:404,temporary:503}[id]; if(code) throw {statusCode:code}; };
  const counts=await runMemoryReminders(client,date,send);
  assert.equal(counts.sent,2); assert.equal(calls,5);
  assert.deepEqual(tables.push_subscriptions.map(row=>row.id),["temporary","ok","peer"]);
  await runMemoryReminders(client,date,send); assert.equal(calls,5);
});
test("uncertain transport outcomes never get retried that day", async () => {
  const {client,tables}=database(); let calls=0;
  const send=async()=>{ calls++; throw new Error("network timeout"); };
  await deliverUserReminder(client,"u",date,[subscription("s")],send);
  await deliverUserReminder(client,"u",date,[subscription("s")],send);
  assert.equal(calls,1); assert.equal(tables.push_notification_deliveries[0].status,"failed");
});
test("subscription validation blocks SSRF, credentials, malformed keys", () => {
  for (const endpoint of ["http://fcm.googleapis.com/a","https://127.0.0.1/a","https://example.com/a","https://fcm.googleapis.com.evil.test/a","https://u@fcm.googleapis.com/a"]) assert.equal(validPushEndpoint(endpoint),false);
  assert.ok(parsePushSubscription({endpoint:subscription("s").endpoint,keys:{p256dh:"A".repeat(87),auth:"A".repeat(22)}}));
  assert.equal(parsePushSubscription({endpoint:subscription("s").endpoint,keys:{p256dh:"short",auth:"short"}}),null);
});

test("worker accepts only same-origin paths, focuses existing windows, and has no fetch cache", async () => {
  const listeners={}; const opened=[]; const shown=[]; const navigated=[]; let focused=0; let windows=[];
  const self={location:{origin:"https://memorimber.test"},addEventListener:(name,handler)=>{listeners[name]=handler;},registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>windows,openWindow:async href=>opened.push(href)}};
  vm.runInNewContext(readFileSync(new URL("../public/sw.js",import.meta.url),"utf8"),{self,URL});
  assert.equal(listeners.fetch,undefined);
  for(const href of ["https://evil.test/","//evil.test/","/\\evil.test/","/\nevil.test/"]) {
    let pending; listeners.push({data:{json:()=>({title:"title",body:"body",href})},waitUntil:p=>{pending=p;}}); await pending;
    assert.equal(shown.at(-1)[1].data.href,"/");
  }
  let pending;
  const click=href=>{listeners.notificationclick({notification:{close(){},data:{href}},waitUntil:p=>{pending=p;}});return pending;};
  await click("/memory/m"); assert.equal(opened[0],"/memory/m");
  windows=[{url:"https://memorimber.test/album",navigate:async href=>{navigated.push(href);return{focus:async()=>focused++};}}];
  await click("/memory/n"); assert.equal(navigated[0],"/memory/n"); assert.equal(focused,1); assert.equal(opened.length,1);
});

test("preview notification uses local showNotification with no delivery or subscription writes", () => {
  const source=readFileSync(new URL("../lib/push-client.ts",import.meta.url),"utf8").split("export async function showPreviewReminder")[1];
  assert.match(source,/registration\.showNotification/);
  assert.doesNotMatch(source,/fetch\(|subscribe\(|deliver|cron|createClient/);
  const preview=readFileSync(new URL("../components/preview-notification-button.tsx",import.meta.url),"utf8");
  assert.match(preview,/isDemo \? \[\] : memories, tree\.items/);
});
test("notification schema is private, account deletion cascades, cron requires auth", () => {
  const sql=readFileSync(new URL("../supabase/migrations/20260911000000_memory_push_notifications.sql",import.meta.url),"utf8");
  assert.equal((sql.match(/enable row level security/g)||[]).length,2);
  assert.equal((sql.match(/references auth.users\(id\) on delete cascade/g)||[]).length,2);
  assert.match(sql,/primary key \(user_id, notification_date\)/);
  assert.match(sql,/revoke all on public.memory_notification_deliveries from anon, authenticated/);
  assert.match(sql,/user_id = \(select auth.uid\(\)\)/);
  const route=readFileSync(new URL("../app/api/cron/memory-reminders/route.ts",import.meta.url),"utf8");
  assert.match(route,/!secret \|\| request.headers.get\("authorization"\) !== `Bearer \$\{secret\}`/);
});

test("preferences reject invalid weekdays and allow an explicit pause", () => {
  for (const weekdays of [[7], [-1], [1.5], ["1"], [1, 1], null]) {
    assert.equal(parseNotificationPreferences({ ...defaultNotificationPreferences(), weekdays }), null);
  }
  assert.equal(parseNotificationPreferences({ harvest_enabled: "true" }), null);
  assert.deepEqual(parseNotificationPreferences({ ...defaultNotificationPreferences(), weekdays: [6, 0] }).weekdays, [0, 6]);
  assert.equal(receivesRemindersOn({ ...defaultNotificationPreferences(), weekdays: [] }, date), false);
  assert.equal(receivesRemindersOn({ ...defaultNotificationPreferences(), harvest_enabled: false, anniversary_enabled: false }, date), false);
  assert.equal(receivesRemindersOn({ ...defaultNotificationPreferences(), weekdays: [5] }, reminderDate(new Date("2026-09-10T15:00:00Z"))), true);
  assert.equal(receivesRemindersOn({ ...defaultNotificationPreferences(), weekdays: [5] }, reminderDate(new Date("2026-09-10T14:59:59Z"))), false);
});

test("devices of the same user receive their own type, weekday and pause settings", async () => {
  const subscriptions = [
    { ...subscription("harvest"), anniversary_enabled: false },
    { ...subscription("anniversary"), harvest_enabled: false },
    { ...subscription("weekend"), weekdays: [0, 6] },
    { ...subscription("paused"), harvest_enabled: false, anniversary_enabled: false },
    { ...subscription("no-days"), weekdays: [] },
  ];
  const { client, tables } = database({ subscriptions });
  tables.memory_fruits.push({ memory_id: "m", ripened_at: "2026-09-10", harvested_at: null });
  const received = new Map();
  const send = async (sub, payload) => received.set(sub.endpoint.split("/").at(-1), JSON.parse(payload));
  await Promise.all([runMemoryReminders(client, date, send), runMemoryReminders(client, date, send)]);
  assert.equal(received.size, 2);
  assert.equal(received.get("harvest").title, "思い出の木");
  assert.equal(received.get("anniversary").title, "1年前のこの頃");
  assert.equal(tables.push_notification_deliveries.length, 2);
  assert.equal(tables.memory_notification_deliveries.length, 0);
});

test("legacy claimed, failed and sent records suppress rollout-day sends only", async () => {
  for (const status of ["claimed", "failed", "sent"]) {
    const { client, tables } = database();
    tables.memory_notification_deliveries.push({ user_id: "u", notification_date: date, status });
    assert.equal(await deliverUserReminder(client, "u", date, [subscription("s")], async () => assert.fail("duplicate")), "skipped");
    let calls = 0;
    await deliverUserReminder(client, "u", "2026-09-12", [subscription("s")], async () => calls++);
    assert.equal(calls, 1);
  }
});

test("deleted devices and fresh preference changes are respected after initial scan", async () => {
  const subscriptions = [subscription("first"), subscription("second")];
  const { client, tables } = database({ subscriptions });
  const sent = [];
  await deliverUserReminder(client, "u", date, subscriptions, async sub => {
    sent.push(sub.endpoint);
    tables.push_subscriptions[1].weekdays = [];
  });
  assert.equal(sent.length, 1);
  tables.push_subscriptions = [];
  assert.equal(await deliverUserReminder(client, "u", "2026-09-12", subscriptions, async () => assert.fail("deleted")), "skipped");
});

function testLimiter() {
  const users = new Set();
  return { rpc: async (name, { p_user_id }) => {
    assert.equal(name, "claim_push_notification_test");
    const data = users.has(p_user_id) ? 60 : 0;
    users.add(p_user_id);
    return { data, error: null };
  } };
}

test("test sends only to the requested owner/device, ignores preferences, and leaves daily records untouched", async () => {
  const own = { ...subscription("own"), weekdays: [], harvest_enabled: false, anniversary_enabled: false };
  const peer = subscription("peer");
  const stranger = subscription("stranger", "v");
  const { client, tables } = database({ subscriptions: [own, peer, stranger], memories: [] });
  const admin = testLimiter();
  const received = [];
  const send = async (sub, payload) => received.push([sub.endpoint, JSON.parse(payload)]);
  assert.equal((await sendTestPush(client, admin, "u", stranger.endpoint, send)).status, 404);
  assert.equal((await sendTestPush(client, admin, "u", own.endpoint, send)).status, 200);
  assert.equal(received.length, 1);
  assert.equal(received[0][0], own.endpoint);
  assert.equal(received[0][1].href, "/settings/notifications");
  assert.equal(tables.push_notification_deliveries.length, 0);
  assert.equal(tables.memory_notification_deliveries.length, 0);
  assert.equal((await sendTestPush(client, admin, "u", peer.endpoint, send)).status, 429);
  assert.equal(received.length, 1);
});

test("test requests respect the shared atomic limiter result", async () => {
  const { client } = database();
  const admin = testLimiter();
  let calls = 0;
  const results = await Promise.all(Array.from({ length: 3 }, () => sendTestPush(client, admin, "u", subscription("s").endpoint, async () => calls++)));
  assert.equal(calls, 1);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 429, 429]);
  assert.equal(results.find(result => result.status === 429).body.retryAfter, 60);
});

test("test expiry removes only that device while transient failures retain registration", async () => {
  for (const statusCode of [404, 410, 503]) {
    const { client, tables } = database({ subscriptions: [subscription("s"), subscription("peer")] });
    const result = await sendTestPush(client, testLimiter(), "u", subscription("s").endpoint, async () => { throw { statusCode }; });
    assert.equal(result.status, statusCode === 503 ? 502 : 410);
    assert.equal(tables.push_subscriptions.length, statusCode === 503 ? 2 : 1);
    assert.ok(tables.push_subscriptions.some(row => row.id === "peer"));
  }
});

test("zero memories sends daily only to enabled devices on selected weekdays", async () => {
  const subscriptions = [
    subscription("daily"),
    { ...subscription("paused"), harvest_enabled: false, anniversary_enabled: false },
    { ...subscription("weekend"), weekdays: [0, 6] },
    { ...subscription("no-days"), weekdays: [] },
  ];
  const { client, tables } = database({ subscriptions, memories: [] });
  const received = [];
  await runMemoryReminders(client, date, async (sub, payload) => received.push([sub.endpoint, JSON.parse(payload)]));
  assert.equal(received.length, 1);
  assert.equal(received[0][0], subscription("daily").endpoint);
  assert.equal(received[0][1].href, "/");
  assert.equal(tables.push_notification_deliveries.length, 1);
  assert.equal(tables.push_notification_deliveries[0].notification_type, "daily");
});

test("eligible memories take priority; disabled kinds use daily rather than leaking through", async () => {
  const subscriptions = [
    { ...subscription("anniversary"), harvest_enabled: false },
    { ...subscription("harvest-only"), anniversary_enabled: false },
  ];
  const { client, tables } = database({ subscriptions });
  const received = new Map();
  await runMemoryReminders(client, date, async (sub, payload) => received.set(sub.endpoint, JSON.parse(payload)));
  assert.equal(received.get(subscription("anniversary").endpoint).href, "/memory/m");
  assert.equal(received.get(subscription("harvest-only").endpoint).title, "メモリンバー");
  assert.deepEqual(tables.push_notification_deliveries.map(row => row.notification_type), ["anniversary", "daily"]);
});

test("daily fallback claims once across concurrent runs, even when transport fails", async () => {
  for (const failed of [false, true]) {
    const { client, tables } = database({ memories: [] });
    let calls = 0;
    const send = async () => { calls++; if (failed) throw new Error("timeout"); };
    await Promise.all([runMemoryReminders(client, date, send), runMemoryReminders(client, date, send)]);
    await runMemoryReminders(client, date, send);
    assert.equal(calls, 1);
    assert.equal(tables.push_notification_deliveries[0].status, failed ? "failed" : "sent");
    await runMemoryReminders(client, "2026-09-12", send);
    assert.equal(calls, 2);
  }
});

test("legacy history also suppresses daily fallback during migration", async () => {
  const { client, tables } = database({ memories: [] });
  tables.memory_notification_deliveries.push({ user_id: "u", notification_date: date, status: "sent" });
  const result = await runMemoryReminders(client, date, async () => assert.fail("legacy duplicate"));
  assert.equal(result.skipped, 1);
  assert.equal(tables.push_notification_deliveries.length, 0);
});

test("a failed memory query is not treated as an empty collection", async () => {
  const { client, tables } = database({ memories: [] });
  const broken = { from(table) {
    if (table === "memories") throw new Error("database unavailable");
    return client.from(table);
  } };
  const result = await runMemoryReminders(broken, date, async () => assert.fail("must not send"));
  assert.equal(result.failed, 1);
  assert.equal(tables.push_notification_deliveries.length, 0);
});
