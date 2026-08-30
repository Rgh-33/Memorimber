"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, ImagePlus, Sprout, Tag, Users } from "lucide-react";
import { SAMPLE_MEMORIES } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

const PEOPLE = ["友達", "家族", "クラスのみんな", "部活の仲間"];
const TAGS = ["放課後", "帰り道", "教室", "行事", "昼休み", "8月"];

export function MemoryForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { addMemory } = useMemories();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("2026-08-25");
  const [people, setPeople] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ image?: string; caption?: string }>({});

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => setImageUrl(String(reader.result)));
    reader.readAsDataURL(file);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      readFile(file);
      setErrors((current) => ({ ...current, image: undefined }));
    }
  };

  const toggle = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      image: imageUrl ? undefined : "写真を1枚選んでください",
      caption: caption.trim() ? undefined : "一言を入力してください",
    };
    setErrors(nextErrors);
    if (nextErrors.image || nextErrors.caption) return;

    const id = addMemory({ imageUrl, caption: caption.trim(), date, people, tags });
    router.push(`/memory/${id}?new=1`);
  };

  return (
    <form onSubmit={handleSubmit} className={`rounded-[22px] border border-line bg-white p-3 shadow-card ${compact ? "" : "mt-5"}`}>
      <div className="mb-2 flex items-center gap-2 px-1 pb-1">
        <Sprout size={21} className="text-coral" strokeWidth={1.7} />
        <p className="font-sans text-base tracking-[0.08em] text-ink">今日の思い出を残す</p>
      </div>

      <label htmlFor="memory-photo" className={`photo-picker relative block overflow-hidden rounded-xl border border-dashed ${errors.image ? "border-red-400 bg-red-50" : "border-coral/45 bg-white"}`}>
        {imageUrl ? (
          <div className="relative aspect-[16/10]">
            <img src={imageUrl} alt="投稿する写真のプレビュー" className="h-full w-full object-cover" />
            <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-ink shadow-sm">写真を変更</span>
          </div>
        ) : (
          <div className="flex min-h-[168px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center text-coral"><ImagePlus size={39} strokeWidth={1.35} /></span>
            <p className="text-sm font-medium text-ink">写真を追加</p>
            <p className="mt-1 text-[11px] text-ink/38">タップして今日の一枚を選択</p>
          </div>
        )}
        <input id="memory-photo" type="file" accept="image/*" className="sr-only" onChange={handleFile} />
      </label>
      <div className="mt-1.5 flex min-h-5 items-center justify-between px-1">
        {errors.image ? <p className="text-[11px] font-medium text-red-500">{errors.image}</p> : <span />}
        <button type="button" onClick={() => { setImageUrl(SAMPLE_MEMORIES[0].imageUrl); setErrors((current) => ({ ...current, image: undefined })); }} className="text-[11px] font-medium text-coral hover:underline">サンプル写真を使う</button>
      </div>

      <div className="relative mt-1">
        <textarea
          id="memory-caption"
          value={caption}
          onChange={(event) => { setCaption(event.target.value.slice(0, 80)); setErrors((current) => ({ ...current, caption: undefined })); }}
          placeholder="一言を残す"
          rows={2}
          aria-label="一言を残す"
          className={`w-full resize-none rounded-lg border bg-white px-3 py-3 pr-12 text-sm leading-5 text-ink outline-none transition placeholder:text-ink/40 focus:border-coral focus:ring-2 focus:ring-coral/10 ${errors.caption ? "border-red-400" : "border-line"}`}
        />
        <span className="absolute bottom-2 right-3 text-[10px] text-ink/30">{caption.length}/80</span>
      </div>
      {errors.caption && <p className="mt-1 px-1 text-[11px] font-medium text-red-500">{errors.caption}</p>}

      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white">
        <label htmlFor="memory-date" className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-line px-3 py-2.5">
          <CalendarDays size={18} className="text-ink" strokeWidth={1.6} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink">日付</span>
            <input id="memory-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 bg-transparent text-right text-xs text-ink/70 outline-none" />
          </div>
        </label>

        <details className="group border-b border-line">
          <summary className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
            <Users size={18} strokeWidth={1.6} />
            <span className="text-xs font-medium">誰と</span>
            <span className="flex items-center gap-1 text-[11px] text-ink/45">{people.length ? `${people.length}件` : "選択する"}<ChevronRight size={15} className="transition group-open:rotate-90" /></span>
          </summary>
          <div className="flex flex-wrap gap-2 bg-paper/60 px-3 pb-3 pt-1">
            {PEOPLE.map((person) => {
              const selected = people.includes(person);
              return <button key={person} type="button" onClick={() => toggle(person, setPeople)} className={`rounded-full border px-3 py-1.5 text-[11px] transition ${selected ? "border-coral bg-coral text-white" : "border-line bg-white text-ink/65"}`}>{selected && <Check size={11} className="mr-1 inline" />}{person}</button>;
            })}
          </div>
        </details>

        <details className="group">
          <summary className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
            <Tag size={18} strokeWidth={1.6} />
            <span className="text-xs font-medium">タグ</span>
            <span className="flex items-center gap-1 text-[11px] text-ink/45">{tags.length ? `${tags.length}件` : "選択する"}<ChevronRight size={15} className="transition group-open:rotate-90" /></span>
          </summary>
          <div className="flex flex-wrap gap-2 bg-paper/60 px-3 pb-3 pt-1">
            {TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return <button key={tag} type="button" onClick={() => toggle(tag, setTags)} className={`rounded-full border px-3 py-1.5 text-[11px] transition ${selected ? "border-coral bg-coral text-white" : "border-line bg-white text-ink/65"}`}>{selected && <Check size={11} className="mr-1 inline" />}{tag}</button>;
            })}
          </div>
        </details>
      </div>

      <button type="submit" className="accent-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition hover:-translate-y-0.5 active:translate-y-0">
        思い出を追加する
      </button>
    </form>
  );
}
