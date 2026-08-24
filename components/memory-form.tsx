"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ImagePlus, Sparkles, Tag, Users } from "lucide-react";
import { SAMPLE_MEMORIES } from "@/lib/data";
import { useMemories } from "@/lib/memories-context";

const PEOPLE = ["友達", "家族", "クラスのみんな", "部活の仲間"];
const TAGS = ["放課後", "帰り道", "教室", "行事", "昼休み", "8月"];

export function MemoryForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { addMemory } = useMemories();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState("2026-08-24");
  const [people, setPeople] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ image?: string; caption?: string }>({});

  const previewDate = useMemo(() => {
    const [year, month, day] = date.split("-");
    return date ? `${year}年${Number(month)}月${Number(day)}日` : "日付を選択";
  }, [date]);

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

    const id = addMemory({
      imageUrl,
      caption: caption.trim(),
      date,
      people,
      tags,
    });
    router.push(`/memory/${id}?new=1`);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${compact ? "" : "rounded-4xl bg-white/80 p-4 shadow-card ring-1 ring-line/60"}`}>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-bold text-ink" htmlFor="memory-photo">
            写真を1枚
          </label>
          <span className="rounded-full bg-sage/25 px-2.5 py-1 text-[11px] font-bold text-ink/60">必須</span>
        </div>
        <label htmlFor="memory-photo" className={`photo-picker relative block overflow-hidden rounded-3xl border-2 border-dashed ${errors.image ? "border-coral bg-coral/5" : "border-line bg-paper/70"}`}>
          {imageUrl ? (
            <div className="relative aspect-[4/3]">
              <img src={imageUrl} alt="投稿する写真のプレビュー" className="h-full w-full object-cover" />
              <span className="absolute left-3 top-3 rounded-full bg-ink/75 px-3 py-1 text-xs font-bold text-white">写真を変更</span>
            </div>
          ) : (
            <div className="flex min-h-[205px] flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-coral shadow-sm">
                <ImagePlus size={27} strokeWidth={1.8} />
              </span>
              <p className="font-bold text-ink">今日の一枚を選ぶ</p>
              <p className="mt-1 text-xs leading-5 text-ink/50">何気ない瞬間も、あとから大切な記憶になります</p>
              <span className="mt-4 rounded-full bg-white px-4 py-2 text-xs font-bold text-ink shadow-sm">写真を選択</span>
            </div>
          )}
          <input id="memory-photo" type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        </label>
        <div className="mt-2 flex items-center justify-between gap-2">
          {errors.image ? <p className="text-xs font-semibold text-coral">{errors.image}</p> : <span />}
          <button type="button" onClick={() => setImageUrl(SAMPLE_MEMORIES[0].imageUrl)} className="ml-auto text-xs font-bold text-ink/50 underline decoration-coral/50 underline-offset-4 hover:text-coral">
            サンプル写真を使う
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-bold text-ink" htmlFor="memory-caption">
            一言を残す
          </label>
          <span className="text-[11px] text-ink/40">{caption.length}/80</span>
        </div>
        <textarea
          id="memory-caption"
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value.slice(0, 80));
            setErrors((current) => ({ ...current, caption: undefined }));
          }}
          placeholder="今日のことを、ひとことだけ。"
          rows={3}
          className={`w-full resize-none rounded-2xl border bg-ivory px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-4 focus:ring-coral/10 ${errors.caption ? "border-coral" : "border-line"}`}
        />
        {errors.caption && <p className="mt-1 text-xs font-semibold text-coral">{errors.caption}</p>}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-ink/70" htmlFor="memory-date">
            <CalendarDays size={15} /> 日付
          </label>
          <input id="memory-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-2xl border border-line bg-ivory px-3 py-3 text-sm font-semibold text-ink outline-none focus:border-coral focus:ring-4 focus:ring-coral/10" />
        </div>
        <span className="rounded-full bg-lavender/65 px-3 py-2 text-[11px] font-bold text-ink/60">{previewDate}</span>
      </div>

      <div className="space-y-4 border-t border-line/70 pt-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink/70"><Users size={15} /> 誰といた？</div>
          <div className="flex flex-wrap gap-2">
            {PEOPLE.map((person) => {
              const selected = people.includes(person);
              return <button key={person} type="button" onClick={() => toggle(person, setPeople)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/65 hover:border-ink/40"}`}>{selected && <Check size={13} className="mr-1 inline" />}{person}</button>;
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink/70"><Tag size={15} /> タグ</div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const selected = tags.includes(tag);
              return <button key={tag} type="button" onClick={() => toggle(tag, setTags)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-coral bg-coral text-white" : "border-line bg-white text-ink/65 hover:border-coral/50"}`}>{selected && <Check size={13} className="mr-1 inline" />}{tag}</button>;
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-paper/80 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink/60"><Sparkles size={14} className="text-sunset" /> 投稿プレビュー</div>
        <div className="flex gap-3">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-line">
            {imageUrl ? <img src={imageUrl} alt="プレビュー" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-ink/30"><ImagePlus size={20} /></div>}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-semibold text-ink/45">{previewDate}</p>
            <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-ink">{caption || "ここに一言が表示されます"}</p>
            {(people.length > 0 || tags.length > 0) && <p className="mt-1 truncate text-[11px] text-ink/50">{[...people, ...tags].join(" · ")}</p>}
          </div>
        </div>
      </div>

      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-4 py-4 text-sm font-bold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-[#e5675b] active:translate-y-0">
        思い出を残す <Check size={18} strokeWidth={2.5} />
      </button>
      <p className="text-center text-[11px] leading-5 text-ink/40">保存した内容は、このブラウザ内のデモ状態にだけ反映されます</p>
    </form>
  );
}
