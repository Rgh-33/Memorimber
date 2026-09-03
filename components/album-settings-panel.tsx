"use client";

import { type ReactNode, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LayoutTemplate, Palette, Sparkles, Type } from "lucide-react";
import { MemoryBookPage } from "@/components/memory-book-page";
import {
  ALBUM_BACKGROUNDS,
  ALBUM_FONTS,
  ALBUM_LAYOUTS,
  ALBUM_PATTERNS,
  ALBUM_TEXT_COLORS,
  usePreferences,
} from "@/lib/preferences-context";
import type { Memory } from "@/lib/types";

const steps = [
  { id: "font", label: "フォント", description: "一言・日付・手紙の書体", icon: Type },
  { id: "layout", label: "レイアウト", description: "写真と言葉の並べ方", icon: LayoutTemplate },
  { id: "text", label: "文字の色", description: "紙面に書く文字の色", icon: Palette },
  { id: "background", label: "背景の色", description: "アルバム用紙の色", icon: Palette },
  { id: "pattern", label: "デザイン", description: "背景に重ねる模様", icon: Sparkles },
] as const;

function ChoiceButton({ selected, label, description, children, onClick }: {
  selected: boolean;
  label: string;
  description?: string;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`album-setting-choice ${selected ? "album-setting-choice--selected" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink">{label}</span>
          {selected && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral text-white" aria-hidden="true"><Check size={13} strokeWidth={2.5} /></span>}
        </span>
        {children}
        {description && <span className="mt-2 block text-[10px] leading-5 text-ink/45">{description}</span>}
      </span>
    </button>
  );
}

export function AlbumSettingsPanel({ memory, contextual = false }: { memory: Memory; contextual?: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const {
    albumFont,
    albumLayout,
    albumTextColor,
    albumBackground,
    albumPattern,
    setAlbumFont,
    setAlbumLayout,
    setAlbumTextColor,
    setAlbumBackground,
    setAlbumPattern,
  } = usePreferences();
  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const moveStep = (amount: number) => setStepIndex((current) => (current + amount + steps.length) % steps.length);
  const placeholderLetter = contextual
    ? "手紙をまだ書いていない場合は、編集の鉛筆から追加できます。書いた言葉はここに続きます。"
    : "あの日の空気や、言えなかったありがとう。写真だけでは残しきれないことを、ここに手紙のように書いておけます。";

  return (
    <div className="mt-6">
      <section aria-label="アルバム設定のプレビュー">
        <div className="album-settings-preview">
          <MemoryBookPage memory={memory} preview previewLetter={placeholderLetter} />
        </div>
        <p className="mt-3 text-center text-[10px] leading-5 text-ink/45">
          {contextual ? "この思い出で組み合わせを確認しています" : "すべての設定を組み合わせた仕上がり例です"}
        </p>
      </section>

      <section className="settings-card mt-5" aria-labelledby="album-setting-step-title">
        <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2">
          <button type="button" onClick={() => moveStep(-1)} className="album-setting-arrow" aria-label="前の設定項目"><ChevronLeft size={20} /></button>
          <div className="text-center" aria-live="polite">
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-paper text-coral"><StepIcon size={17} /></span>
            <h2 id="album-setting-step-title" className="mt-2 text-base font-semibold text-ink">{step.label}</h2>
            <p className="mt-1 text-[10px] text-ink/45">{step.description}</p>
          </div>
          <button type="button" onClick={() => moveStep(1)} className="album-setting-arrow" aria-label="次の設定項目"><ChevronRight size={20} /></button>
        </div>

        <div className="mt-3 flex justify-center gap-1.5" aria-label={`${stepIndex + 1} / ${steps.length}`}>
          {steps.map((item, index) => <span key={item.id} className={`h-1.5 rounded-full transition-all ${index === stepIndex ? "w-5 bg-coral" : "w-1.5 bg-line"}`} />)}
        </div>

        <div className="mt-5 grid gap-3" role="radiogroup" aria-label={step.label}>
          {step.id === "font" && ALBUM_FONTS.map((option) => (
            <ChoiceButton key={option.id} selected={albumFont === option.id} label={option.label} description={option.description} onClick={() => setAlbumFont(option.id)}>
              <span className={`album-font-preview album-font-${option.id} mt-2 block text-[20px] leading-8 text-ink`}>忘れたくない、今日のこと。</span>
            </ChoiceButton>
          ))}

          {step.id === "layout" && ALBUM_LAYOUTS.map((option) => (
            <ChoiceButton key={option.id} selected={albumLayout === option.id} label={option.label} description={option.description} onClick={() => setAlbumLayout(option.id)}>
              <span className={`album-layout-swatch album-layout-swatch--${option.id}`} aria-hidden="true"><i /><i /><i /></span>
            </ChoiceButton>
          ))}

          {step.id === "text" && ALBUM_TEXT_COLORS.map((option) => (
            <ChoiceButton key={option.id} selected={albumTextColor === option.id} label={option.label} onClick={() => setAlbumTextColor(option.id)}>
              <span className="mt-3 flex items-center gap-3">
                <span className="h-7 w-7 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: option.color }} />
                <span className={`album-font-preview album-font-${albumFont} text-lg`} style={{ color: option.color }}>大切な一日</span>
              </span>
            </ChoiceButton>
          ))}

          {step.id === "background" && ALBUM_BACKGROUNDS.map((option) => (
            <ChoiceButton key={option.id} selected={albumBackground === option.id} label={option.label} onClick={() => setAlbumBackground(option.id)}>
              <span className="mt-3 block h-10 rounded-xl border border-black/10 shadow-inner" style={{ backgroundColor: option.color }} />
            </ChoiceButton>
          ))}

          {step.id === "pattern" && ALBUM_PATTERNS.map((option) => (
            <ChoiceButton key={option.id} selected={albumPattern === option.id} label={option.label} description={option.description} onClick={() => setAlbumPattern(option.id)}>
              <span className={`album-pattern-swatch album-pattern-swatch--${option.id}`} aria-hidden="true" />
            </ChoiceButton>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px] leading-5 text-ink/40">選ぶたびに保存され、上の例へすぐ反映されます。</p>
      </section>
    </div>
  );
}
