import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import * as React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { unstable_rethrow } = require("next/navigation");
const source = readFileSync(new URL("../components/shared-memory-menu.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
});
const props = {
  groupId: "11111111-1111-4111-8111-111111111111",
  memoryId: "22222222-2222-4222-8222-222222222222",
  caption: "家族の写真",
};

function find(element, predicate) {
  if (!React.isValidElement(element)) return undefined;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

function harness({ result = null, pending = false } = {}) {
  const submissions = [];
  const closed = [];
  const removeAction = async (previous, formData) => {
    submissions.push({ previous, entries: [...formData] });
  };
  const dispatch = (formData) => removeAction(result, formData);
  const SubmitButton = () => null;
  const modules = {
    react: {
      ...React,
      useState: () => [true, (state) => closed.push(state)],
      useRef: () => ({ current: null }),
      useActionState(action, initial) {
        assert.equal(action, removeAction);
        assert.equal(initial, null);
        return [result, dispatch, pending];
      },
    },
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/navigation": { unstable_rethrow },
    "lucide-react": { Ellipsis: () => null },
    "@/components/shared-group-dialog": { SharedGroupDialog: () => null },
    "@/components/shared-group-submit-button": { SharedGroupSubmitButton: SubmitButton },
    "@/app/shared-groups/actions": { removeSharedMemoryAction: removeAction },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected component dependency: ${name}`);
    return modules[name];
  }, loaded, loaded.exports);
  const menu = loaded.exports.SharedMemoryMenu(props);
  const boundaryElement = find(menu, (element) => Boolean(element.type.getDerivedStateFromError));
  assert.ok(boundaryElement, "the opened menu must contain a removal dialog boundary");
  const boundary = new boundaryElement.type(boundaryElement.props);
  const child = boundary.render();
  const dialog = child.type(child.props);
  const form = find(dialog, (element) => element.type === "form");
  return { boundary, dialog, form, dispatch, SubmitButton, submissions, closed };
}

test("the confirmation form directly dispatches the server action with both IDs", async () => {
  const h = harness();
  assert.equal(h.form.props.action, h.dispatch);
  const formData = new FormData();
  for (const child of React.Children.toArray(h.form.props.children)) {
    if (child.type === "input") formData.append(child.props.name, child.props.value);
  }
  await h.form.props.action(formData);
  assert.deepEqual(h.submissions, [{ previous: null, entries: [
    ["groupId", props.groupId], ["memoryId", props.memoryId],
  ] }]);
  assert.deepEqual(h.closed, [], "submitting must not close the confirmation locally");
});

test("pending removal disables dismissal and submission without losing IDs", () => {
  const h = harness({ pending: true });
  assert.equal(h.dialog.props.busy, true);
  assert.equal(h.form.props["aria-busy"], true);
  assert.equal(find(h.form, (element) => element.type === "button").props.disabled, true);
  assert.equal(find(h.form, (element) => element.type === h.SubmitButton).props.disabled, true);
  assert.equal(find(h.form, (element) => element.props.name === "memoryId").props.disabled, undefined);
});

test("a returned removal error stays inside a retryable confirmation", () => {
  const h = harness({ result: { ok: false, error: "共有を解除する権限がありません。" } });
  assert.equal(find(h.form, (element) => element.props.role === "alert").props.children, "共有を解除する権限がありません。");
  assert.equal(find(h.form, (element) => element.type === h.SubmitButton).props.children, "もう一度試す");
  assert.equal(h.dialog.props.busy, false);
  assert.deepEqual(h.closed, []);
});

test("transport failures replace the stopped action form and retry remounts it", () => {
  const h = harness();
  const originalForm = h.boundary.render();
  h.boundary.state = h.boundary.constructor.getDerivedStateFromError(new TypeError("Failed to fetch"));
  const fallback = h.boundary.render();
  assert.notEqual(fallback.type, originalForm.type);
  assert.ok(find(fallback, (element) => element.props.role === "alert"));
  h.boundary.setState = (state) => { h.boundary.state = state; };
  find(fallback, (element) => element.type === "button" && element.props.children === "もう一度試す").props.onClick();
  assert.equal(h.boundary.render().type, originalForm.type);
});

test("the removal boundary lets Next.js handle a successful server redirect", () => {
  const h = harness();
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;replace;/shared-groups/${props.groupId};303;`,
  });
  assert.throws(() => h.boundary.constructor.getDerivedStateFromError(redirect), (error) => error === redirect);
});
