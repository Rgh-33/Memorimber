import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { chooseFadingMemoryId, readMemoryRecallState, recordMemoryReview } from "../lib/memory-recall.ts";

// Exercise the hook's three operations with controlled React state and RPCs.
function harness({ configured = true, id = "konoha-preview-00000001", failRestore = false } = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0;
  const memory = { id };
  const memories = [memory];
  const localQuestion = { id: "local-question", correctChoiceId: "choice" };
  const savedQuestion = { id: "saved-question", correctChoiceId: "choice" };
  const mocks = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
      },
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!slots[index] || deps.some((dep, i) => dep !== slots[index][i])) effects.push(effect);
        slots[index] = deps;
      },
    },
    "@/lib/quiz": { createMemoryQuizQuestion: () => localQuestion },
    "@/lib/supabase/config": { isSupabaseConfigured: () => configured },
    "@/lib/supabase/shared-albums": { isUuid: value => /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value) },
    "@/lib/personal-quiz": {
      startPersonalQuiz: async () => { calls.push("start"); return [savedQuestion]; },
      answerPersonalQuiz: async questionId => { calls.push(["answer", questionId]); return savedQuestion; },
      restorePetal: async questionId => { calls.push(["restore", questionId]); if (failRestore) throw new Error("DB restore failed"); },
    },
  };
  const exports = {};
  const source = readFileSync(new URL("../lib/use-persisted-memory-question.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", compiled)(name => { assert.ok(mocks[name], name); return mocks[name]; }, exports);
  return { calls, async render() {
    cursor = 0;
    const hook = exports.usePersistedMemoryQuestion("recall", memory, memories);
    effects.splice(0).forEach(effect => effect());
    await Promise.resolve();
    return hook;
  } };
}

test("preview recall can answer and restore with Supabase configured without any RPC", async () => {
  const h = harness();
  await h.render();
  const question = await h.render();
  assert.equal(question.ready, true);
  assert.equal(await question.answer("choice"), true);
  await question.restore();
  assert.deepEqual(h.calls, []);
});

test("offline demo recall also restores locally", async () => {
  const h = harness({ configured: false });
  await h.render();
  const question = await h.render();
  assert.equal(await question.answer("choice"), true);
  await question.restore();
  assert.deepEqual(h.calls, []);
});

test("real recall keeps server question, answer and restoration", async () => {
  const h = harness({ id: "11111111-1111-4111-8111-111111111111" });
  await h.render();
  const question = await h.render();
  assert.equal(await question.answer("choice"), true);
  await (await h.render()).restore();
  assert.deepEqual(h.calls, ["start", ["answer", "saved-question"], ["restore", "saved-question"]]);
});

test("real restoration errors still prevent local success", async () => {
  const h = harness({ id: "11111111-1111-4111-8111-111111111111", failRestore: true });
  await h.render();
  const question = await h.render();
  await question.answer("choice");
  await assert.rejects(() => question.restore(), /DB restore failed/);
});

test("preview review survives storage and fades again seven preview days later", () => {
  const petals = [{ id: "preview", memoryId: "preview", stage: "harvested", harvestedAt: "2030-09-01T12:00:00" }];
  const initial = { reviewedAt: {}, featuredId: null };
  const date = day => new Date(`2030-09-${String(day).padStart(2, "0")}T12:00:00`).getTime();
  assert.equal(chooseFadingMemoryId(petals, initial, date(7)), null);
  assert.equal(chooseFadingMemoryId(petals, initial, date(8)), "preview");
  const restored = readMemoryRecallState(JSON.stringify(recordMemoryReview(initial, "preview", date(8))));
  assert.equal(chooseFadingMemoryId(petals, restored, date(8)), null);
  assert.equal(chooseFadingMemoryId(petals, restored, date(14)), null);
  assert.equal(chooseFadingMemoryId(petals, restored, date(15)), "preview");
});

test("preview hides a new petal immediately but does not hide it again after restoration", () => {
  const now = new Date("2030-09-01T12:00:00").getTime();
  const petals = [{ id: "preview", memoryId: "preview", stage: "harvested", harvestedAt: "2030-09-01T12:00:00" }];
  const initial = { reviewedAt: {}, featuredId: null };
  const options = { ignoreAge: true };
  assert.equal(chooseFadingMemoryId(petals, initial, now), null);
  assert.equal(chooseFadingMemoryId(petals, initial, now, options), "preview");
  const restored = readMemoryRecallState(JSON.stringify(recordMemoryReview(initial, "preview", now)));
  assert.equal(chooseFadingMemoryId(petals, restored, now, options), null);
  assert.equal(chooseFadingMemoryId(petals, restored, now + 7 * 86400000 - 1, options), null);
  assert.equal(chooseFadingMemoryId(petals, restored, now + 7 * 86400000, options), "preview");
});
