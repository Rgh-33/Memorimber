"use client";

/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronRight, ImagePlus, Sprout, Tag, Users } from "lucide-react";
import { useMemories } from "@/lib/memories-context";
import { useProcessing } from "@/lib/processing-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getMemoryImageType, MEMORY_IMAGE_ACCEPT, MemorySaveError, PENDING_MEMORY_STORAGE_KEY, readPendingMemoryUpload, recoverMemorySave, saveMemory, type MemorySaveStage, type PendingMemoryUpload } from "@/lib/supabase/memories";

const PEOPLE = ["友達", "家族", "クラスのみんな", "部活の仲間"];
const TAGS = ["放課後", "帰り道", "教室", "行事", "昼休み", "8月"];
const STAGE_LABELS: Record<MemorySaveStage, string> = {
  auth: "ログインを確認しています…", upload: "写真をアップロードしています…",
  insert: "思い出を保存しています…", cleanup: "保存状態を確認・後片付けしています…",
};
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function MemoryForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { refreshMemories } = useMemories();
  const { startProcessing, stopProcessing } = useProcessing();
  const configured = isSupabaseConfigured();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(today);
  const [people, setPeople] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ image?: string; caption?: string }>({});
  const [stage, setStage] = useState<MemorySaveStage | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMemoryUpload | null>(null);
  const busy = stage !== null;

  useEffect(() => {
    try {
      const interrupted = readPendingMemoryUpload(window.sessionStorage);
      if (interrupted) {
        setPending(interrupted);
        setSaveError("前回の投稿処理が中断されています。再投稿の前に「保存状態を確認・後片付け」を押してください。");
      }
    } catch { /* Storage-disabled browsers are handled before any upload. */ }
  }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    if (!busy && !pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [busy, pending]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        getMemoryImageType(file);
        setImage(file);
        setImageUrl(URL.createObjectURL(file));
        setPreviewFailed(false);
        setErrors((current) => ({ ...current, image: undefined }));
      } catch (cause) {
        setImage(null);
        setImageUrl("");
        event.target.value = "";
        setErrors((current) => ({ ...current, image: cause instanceof Error ? cause.message : "写真を読み込めませんでした。" }));
      }
    }
  };

  const toggle = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const onSaved = async () => {
    setSaveError(null);
    clearPending();
    setImage(null);
    setImageUrl("");
    setCaption("");
    setDate(today());
    setPeople([]);
    setTags([]);
    setErrors({});
    formRef.current?.reset();
    await refreshMemories();
    router.replace("/", { scroll: true });
  };

  const clearPending = () => {
    setPending(null);
    try { window.sessionStorage.removeItem(PENDING_MEMORY_STORAGE_KEY); } catch { /* Retry on next visit is safe. */ }
  };

  const rememberPending = (attempt: PendingMemoryUpload) => {
    try {
      window.sessionStorage.setItem(PENDING_MEMORY_STORAGE_KEY, JSON.stringify(attempt));
    } catch {
      throw new Error("投稿の復旧情報をブラウザに記録できません。ブラウザのストレージ設定を確認してください。まだ写真は送信していません。");
    }
    setPending(attempt);
  };

  const showSaveError = (cause: unknown) => {
    setSaveError(cause instanceof Error ? cause.message : "保存できませんでした。通信状態を確認してください。");
    if (cause instanceof MemorySaveError && cause.pending) setPending(cause.pending);
    else clearPending();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || pending || !configured) return;
    const nextErrors = {
      image: image ? undefined : "写真を1枚選んでください",
      caption: caption.trim() ? undefined : "一言を入力してください",
    };
    setErrors(nextErrors);
    if (nextErrors.image || nextErrors.caption || !image) return;

    submittingRef.current = true;
    setSaveError(null);
    setStage("auth");
    startProcessing();
    try {
      await saveMemory(createClient(), { image, caption, date, people, tags }, setStage, rememberPending);
      await onSaved();
    } catch (cause) {
      showSaveError(cause);
    } finally {
      submittingRef.current = false;
      setStage(null);
      stopProcessing();
    }
  };

  const handleRecovery = async () => {
    if (!pending || submittingRef.current) return;
    submittingRef.current = true;
    setStage("cleanup");
    startProcessing();
    try {
      const result = await recoverMemorySave(createClient(), pending);
      if (result.saved) await onSaved();
      else {
        clearPending();
        setSaveError("未保存の画像を取り消しました。入力内容を確認して、もう一度投稿できます。");
      }
    } catch (cause) {
      showSaveError(cause);
    } finally {
      submittingRef.current = false;
      setStage(null);
      stopProcessing();
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} aria-busy={busy} className={`rounded-[22px] border border-line bg-ivory p-3 shadow-card ${compact ? "" : "mt-5"}`}>
      {!configured && <p role="status" className="mb-3 text-xs leading-5 text-ink/70">Supabaseの接続設定後、ログインすると投稿できます。この画面での一時保存は行いません。</p>}
      <fieldset disabled={busy || Boolean(pending) || !configured} className="min-w-0 disabled:opacity-60">
      <div className="mb-2 flex items-center gap-2 px-1 pb-1">
        <Sprout size={21} className="text-coral" strokeWidth={1.7} />
        <p className="font-sans text-base tracking-[0.08em] text-ink">今日の思い出を残す</p>
      </div>

      <label htmlFor="memory-photo" className={`photo-picker relative block overflow-hidden rounded-xl border border-dashed ${errors.image ? "border-red-400 bg-red-50" : "border-coral/45 bg-ivory"}`}>
        {image && previewFailed ? (
          <div className="flex min-h-[168px] flex-col items-center justify-center gap-2 px-5 text-center text-xs text-ink/70"><ImagePlus className="text-coral" size={32} /><p className="max-w-full break-all">{image.name}</p><p>このブラウザではプレビューできませんが、<br />元の写真をそのまま保存できます。</p><span className="text-coral">タップして写真を変更</span></div>
        ) : imageUrl ? (
          <div className="relative aspect-[16/10]">
            <img src={imageUrl} alt="投稿する写真のプレビュー" onError={() => setPreviewFailed(true)} className="h-full w-full object-cover" />
            <span className="absolute right-3 top-3 rounded-full bg-ivory/90 px-3 py-1 text-[11px] font-medium text-ink shadow-sm">写真を変更</span>
          </div>
        ) : (
          <div className="flex min-h-[168px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center text-coral"><ImagePlus size={39} strokeWidth={1.35} /></span>
            <p className="text-sm font-medium text-ink">写真を追加</p>
            <p className="mt-1 text-[11px] text-ink/38">タップして今日の一枚を選択</p>
          </div>
        )}
        <input id="memory-photo" type="file" accept={MEMORY_IMAGE_ACCEPT} className="sr-only" onChange={handleFile} />
      </label>
      <div className="mt-1.5 flex min-h-5 items-center justify-between px-1">
        {errors.image ? <p className="text-[11px] font-medium text-red-500">{errors.image}</p> : <span />}
        <span className="text-[10px] text-ink/55">JPEG / PNG / WebP / HEIC / HEIF・20MBまで</span>
      </div>

      <div className="relative mt-1">
        <textarea
          id="memory-caption"
          value={caption}
          onChange={(event) => { setCaption(event.target.value.slice(0, 80)); setErrors((current) => ({ ...current, caption: undefined })); }}
          placeholder="一言を残す"
          rows={2}
          aria-label="一言を残す"
          className={`w-full resize-none rounded-lg border bg-ivory px-3 py-3 pr-12 text-sm leading-5 text-ink outline-none transition placeholder:text-ink/40 focus:border-coral focus:ring-2 focus:ring-coral/10 ${errors.caption ? "border-red-400" : "border-line"}`}
        />
        <span className="absolute bottom-2 right-3 text-[10px] text-ink/30">{caption.length}/80</span>
      </div>
      {errors.caption && <p className="mt-1 px-1 text-[11px] font-medium text-red-500">{errors.caption}</p>}

      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-ivory">
        <label htmlFor="memory-date" className="grid grid-cols-[auto_1fr] items-center gap-3 border-b border-line px-3 py-2.5">
          <CalendarDays size={18} className="text-ink" strokeWidth={1.6} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-ink">日付</span>
            <input id="memory-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 bg-transparent text-right text-xs text-ink/70 outline-none" />
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
              return <button key={person} type="button" onClick={() => toggle(person, setPeople)} className={`rounded-full border px-3 py-1.5 text-[11px] transition ${selected ? "border-coral bg-coral text-white" : "border-line bg-ivory text-ink/65"}`}>{selected && <Check size={11} className="mr-1 inline" />}{person}</button>;
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
              return <button key={tag} type="button" onClick={() => toggle(tag, setTags)} className={`rounded-full border px-3 py-1.5 text-[11px] transition ${selected ? "border-coral bg-coral text-white" : "border-line bg-ivory text-ink/65"}`}>{selected && <Check size={11} className="mr-1 inline" />}{tag}</button>;
            })}
          </div>
        </details>
      </div>

      </fieldset>
      {saveError && <p role="alert" className="mt-3 break-words rounded-lg border border-red-400/40 p-3 text-xs leading-6 text-ink">{saveError}</p>}
      {pending && !busy && <button type="button" onClick={handleRecovery} className="mt-2 w-full rounded-lg border border-coral px-3 py-2 text-xs text-coral">保存状態を確認・後片付け</button>}
      <button type="submit" disabled={busy || Boolean(pending) || !configured} className="accent-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-medium tracking-[0.08em] text-white shadow-sm transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
        <span role="status">{stage ? STAGE_LABELS[stage] : "思い出を追加する"}</span>
      </button>
      {busy && <p className="mt-2 text-center text-[11px] text-ink/60">完了するまで、この画面を閉じずにお待ちください。</p>}
    </form>
  );
}
