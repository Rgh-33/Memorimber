"use client";

import { useState } from "react";
import { useTree } from "@/lib/tree-context";
import { useMemories } from "@/lib/memories-context";
import { selectMemoryReminder } from "@/lib/memory-reminders";
import { showPreviewReminder } from "@/lib/push-client";

export function PreviewNotificationButton() {
  const tree = useTree();
  const { memories, isLoading, error } = useMemories();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!tree.preview) return null;
  const test = async () => {
    setMessage("");
    if (isLoading || error) { setMessage("保存済みの思い出を読み込んでから、もう一度お試しください。"); return; }
    // Legacy demo builds used `isDemo ? [] : memories, tree.items`; the unified
    // preview store now intentionally supplies the same local memories in both cases.
    const reminder = selectMemoryReminder("preview", tree.date, memories, tree.items);
    if (!reminder) { setMessage("このプレビュー日付には通知できる思い出がありません。"); return; }
    setBusy(true);
    try { await showPreviewReminder(reminder); setMessage("テスト通知を表示しました。"); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "通知を表示できませんでした。"); }
    finally { setBusy(false); }
  };
  return <div className="mt-2">
    <button type="button" disabled={busy || !tree.ready} onClick={() => void test()} className="min-h-9 w-full rounded-lg border border-line bg-ivory px-3 py-2 text-xs text-ink disabled:opacity-50">{busy ? "通知を準備中…" : "通知をテスト"}</button>
    {message && <p role="status" className="mt-1 text-xs leading-5 text-ink/70">{message}</p>}
  </div>;
}
