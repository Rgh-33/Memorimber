"use client";

import { useParams } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { AlbumSettingsPanel } from "@/components/album-settings-panel";
import { SettingsHeader } from "@/components/settings-header";
import { SAMPLE_MEMORIES } from "@/lib/data";
import { APP_COLOR_MODES, APP_THEMES, usePreferences } from "@/lib/preferences-context";

const sectionLabels = {
  style: "スタイル",
  sound: "サウンド",
  tree: "木",
  album: "アルバム",
  quiz: "クイズ",
  post: "写真の追加",
  more: "その他",
} as const;

type SettingSection = keyof typeof sectionLabels;

function isSettingSection(value: string): value is SettingSection {
  return value in sectionLabels;
}

function VolumeSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium text-ink">
        {label}
        <output className="text-xs tabular-nums text-ink/50">{value}%</output>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="settings-volume mt-3 w-full"
        aria-label={`${label}の音量`}
      />
    </label>
  );
}

export default function SettingDetailPage() {
  const params = useParams<{ section: string }>();
  const section = params.section;
  const {
    theme,
    colorMode,
    bgmVolume,
    soundEffectVolume,
    setTheme,
    setColorMode,
    setBgmVolume,
    setSoundEffectVolume,
  } = usePreferences();

  if (!isSettingSection(section)) {
    return (
      <div className="page-pad">
        <SettingsHeader />
        <p className="mt-16 text-center text-sm text-ink/60">設定項目が見つかりません。</p>
      </div>
    );
  }

  const label = sectionLabels[section];

  return (
    <div className="page-pad">
      <SettingsHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">PREFERENCES</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">{label}</h1>
      </section>

      {section === "style" && (
        <div className="mt-7 space-y-4">
          <section className="settings-card" aria-labelledby="mode-heading">
            <h2 id="mode-heading" className="text-base font-semibold text-ink">テーマ</h2>
            <p className="mt-1 text-xs leading-6 text-ink/50">画面全体の明るさを選びます。</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="明るさのテーマ">
              {APP_COLOR_MODES.map((option) => {
                const selected = colorMode === option.id;
                const Icon = option.id === "light" ? Sun : Moon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setColorMode(option.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                      selected ? "border-coral bg-coral text-white shadow-sm" : "border-line bg-ivory text-ink/65 hover:border-coral/55"
                    }`}
                  >
                    <Icon size={17} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-card" aria-labelledby="style-heading">
            <h2 id="style-heading" className="text-base font-semibold text-ink">スタイル</h2>
            <p className="mt-1 text-xs leading-6 text-ink/50">選んだ色をアプリ全体へ反映します。</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="テーマカラー">
              {APP_THEMES.map((option) => {
                const selected = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(option.id)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-xs font-medium transition ${
                      selected ? "border-coral bg-paper text-ink shadow-sm" : "border-line bg-ivory text-ink/65 hover:border-coral/55"
                    }`}
                  >
                    <span
                      className={`theme-swatch h-5 w-5 shrink-0 rounded-full border-2 border-ivory ${selected ? "ring-2 ring-coral/25" : ""}`}
                      style={{ backgroundColor: option.swatch }}
                      aria-hidden="true"
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {section === "sound" && (
        <section className="settings-card mt-7" aria-labelledby="sound-heading">
          <h2 id="sound-heading" className="text-base font-semibold text-ink">音量</h2>
          <p className="mt-1 text-xs leading-6 text-ink/50">音源追加後に、この値をそのまま接続できます。</p>
          <div className="mt-6 space-y-6">
            <VolumeSetting label="BGM" value={bgmVolume} onChange={setBgmVolume} />
            <VolumeSetting label="効果音" value={soundEffectVolume} onChange={setSoundEffectVolume} />
          </div>
        </section>
      )}

      {section === "album" && (
        <AlbumSettingsPanel memory={SAMPLE_MEMORIES[0]} harvestWord="帰り道" />
      )}

      {section !== "style" && section !== "sound" && section !== "album" && (
        <section className="settings-card mt-7">
          <p className="rounded-xl border border-dashed border-line bg-paper/60 px-4 py-8 text-center text-sm leading-7 text-ink/55">
            「{label}」の項目はまだ設定されていません。
          </p>
        </section>
      )}
    </div>
  );
}
