"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Save, Trash2, X } from "lucide-react";
import { useProcessing } from "@/lib/processing-context";
import { createClient } from "@/lib/supabase/client";
import { deleteMemory, MAX_MEMORY_LETTER_LENGTH, updateMemory } from "@/lib/supabase/memories";
import type { Memory, MemoryUpdateInput } from "@/lib/types";

const listValue = (values: string[]) => values.join("、");
const parseList = (value: string) => value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);

export function MemoryDetailActions({
  memory,
  mode,
  onUpdated,
  onDeleted,
  onClose,
  onDraftChange,
}: {
  memory: Memory;
  mode: "edit" | "delete";
  onUpdated: (memory: Memory) => void;
  onDeleted: () => void;
  onClose: () => void;
  onDraftChange?: (draft: MemoryUpdateInput) => void;
}) {
  const { startProcessing, stopProcessing } = useProcessing();
  const [caption, setCaption] = useState(memory.caption);
  const [date, setDate] = useState(memory.date);
  const [people, setPeople] = useState(listValue(memory.people));
  const [tags, setTags] = useState(listValue(memory.tags));
  const [letter, setLetter] = useState(memory.letter ?? "");
  const [busy, setBusy] = useState<"update" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (next: Partial<{ caption: string; date: string; people: string; tags: string; letter: string }>) => {
    onDraftChange?.({
      caption: next.caption ?? caption,
      date: next.date ?? date,
      people: parseList(next.people ?? people),
      tags: parseList(next.tags ?? tags),
      letter: next.letter ?? letter,
    });
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy("update");
    setError(null);
    startProcessing();
    try {
      const updated = await updateMemory(createClient(), memory.id, {
        caption,
        date,
        people: parseList(people),
        tags: parseList(tags),
        letter,
      });
      onUpdated({ ...updated, imageUrl: memory.imageUrl });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "思い出を更新できませんでした。");
    } finally {
      setBusy(null);
      stopProcessing();
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy("delete");
    setError(null);
    startProcessing();
    try {
      await deleteMemory(createClient(), memory.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "思い出を削除できませんでした。");
    } finally {
      setBusy(null);
      stopProcessing();
    }
  };

  return (
    <section className="mt-4" aria-label="思い出の操作">
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-400/40 bg-red-50/50 p-3 text-xs leading-6 text-ink">{error}</p>}

      {mode === "edit" ? (
        <form onSubmit={handleUpdate} className="rounded-2xl border border-line bg-paper/55 p-4" aria-busy={busy === "update"}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">思い出と手紙を編集</h2>
              <p className="mt-1 text-[10px] leading-5 text-ink/45">手紙は空欄のままでも保存できます。</p>
            </div>
            <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-full p-1.5 text-ink/55 hover:bg-ivory disabled:opacity-40" aria-label="編集を閉じる"><X size={17} /></button>
          </div>
          <fieldset disabled={Boolean(busy)} className="mt-4 space-y-3 disabled:opacity-60">
            <label className="block text-xs font-medium text-ink">
              一言
              <textarea value={caption} onChange={(event) => {
                const next = event.target.value.slice(0, 80);
                setCaption(next);
                updateDraft({ caption: next });
              }} required maxLength={80} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm leading-6 outline-none focus:border-coral focus:ring-2 focus:ring-coral/10" />
              <span className="mt-1 block text-right text-[10px] font-normal text-ink/45">{caption.length}/80</span>
            </label>
            <label className="block text-xs font-medium text-ink">
              日付
              <input type="date" value={date} onChange={(event) => { setDate(event.target.value); updateDraft({ date: event.target.value }); }} required className="mt-1.5 w-full rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/10" />
            </label>
            <label className="block text-xs font-medium text-ink">
              人物 <span className="font-normal text-ink/40">（任意）</span>
              <input type="text" value={people} onChange={(event) => { setPeople(event.target.value); updateDraft({ people: event.target.value }); }} placeholder="友達、家族" className="mt-1.5 w-full rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/10" />
              <span className="mt-1 block text-[10px] font-normal text-ink/45">複数ある場合は「、」またはカンマで区切ります</span>
            </label>
            <label className="block text-xs font-medium text-ink">
              タグ <span className="font-normal text-ink/40">（任意）</span>
              <input type="text" value={tags} onChange={(event) => { setTags(event.target.value); updateDraft({ tags: event.target.value }); }} placeholder="放課後、帰り道" className="mt-1.5 w-full rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/10" />
              <span className="mt-1 block text-[10px] font-normal text-ink/45">複数ある場合は「、」またはカンマで区切ります</span>
            </label>
            <label className="block text-xs font-medium text-ink">
              手紙 <span className="font-normal text-ink/40">（任意）</span>
              <textarea value={letter} onChange={(event) => {
                const next = event.target.value.slice(0, MAX_MEMORY_LETTER_LENGTH);
                setLetter(next);
                updateDraft({ letter: next });
              }} maxLength={MAX_MEMORY_LETTER_LENGTH} rows={8} placeholder="あの日のことや、未来の自分へ残したい言葉を自由に書けます。" className="mt-1.5 w-full resize-y rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm leading-7 outline-none placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/10" />
              <span className="mt-1 block text-right text-[10px] font-normal text-ink/45">{letter.length}/{MAX_MEMORY_LETTER_LENGTH}</span>
            </label>
          </fieldset>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-xl border border-line bg-ivory px-3 py-3 text-xs font-medium text-ink disabled:opacity-40">キャンセル</button>
            <button type="submit" disabled={Boolean(busy)} className="accent-gradient flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-medium text-white disabled:opacity-50"><Save size={15} />{busy === "update" ? "保存中…" : "変更を保存"}</button>
          </div>
        </form>
      ) : (
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-memory-title" aria-describedby="delete-memory-description" className="rounded-2xl border border-red-300/60 bg-red-50/60 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={21} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <h2 id="delete-memory-title" className="text-sm font-semibold text-ink">この思い出を削除しますか？</h2>
              <p id="delete-memory-description" className="mt-1.5 text-xs leading-6 text-ink/65">一言などの記録と写真を削除します。この操作は取り消せません。</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-xl border border-line bg-ivory px-3 py-3 text-xs font-medium text-ink disabled:opacity-40">戻る</button>
            <button type="button" onClick={() => void handleDelete()} disabled={Boolean(busy)} className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-3 text-xs font-medium text-white disabled:opacity-50"><Trash2 size={15} />{busy === "delete" ? "削除中…" : "削除する"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
