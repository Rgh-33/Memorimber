"use client";

import { useParams } from "next/navigation";
import { AlbumSettingsPanel } from "@/components/album-settings-panel";
import { SettingsHeader } from "@/components/settings-header";
import { useMemories } from "@/lib/memories-context";

export default function MemoryAlbumSettingsPage() {
  const params = useParams<{ id: string }>();
  const { getMemory, isLoading, error } = useMemories();
  const memory = getMemory(params.id);

  return (
    <div className="page-pad">
      <SettingsHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">ALBUM PREVIEW</p>
        <h1 className="mt-2 text-[23px] font-semibold tracking-[0.07em] text-ink">この思い出の見た目</h1>
        <p className="mt-2 text-xs leading-6 text-ink/50">今見ている思い出で、印刷の仕上がりを試せます。</p>
      </section>

      {isLoading && !memory ? (
        <p role="status" className="mt-12 text-center text-sm text-ink/55">思い出を読み込んでいます…</p>
      ) : error && !memory ? (
        <p role="alert" className="mt-12 rounded-xl border border-line p-4 text-sm leading-6 text-ink">{error}</p>
      ) : memory ? (
        <AlbumSettingsPanel memory={memory} contextual />
      ) : (
        <p className="mt-12 text-center text-sm text-ink/55">思い出が見つかりません。</p>
      )}
    </div>
  );
}
