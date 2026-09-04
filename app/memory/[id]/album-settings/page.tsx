"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlbumSettingsPanel } from "@/components/album-settings-panel";
import { SettingsHeader } from "@/components/settings-header";
import type { AlbumAppearance } from "@/lib/album-appearance";
import { useMemories } from "@/lib/memories-context";
import { usePreferences } from "@/lib/preferences-context";
import { createClient } from "@/lib/supabase/client";
import { updateMemoryAlbumAppearance } from "@/lib/supabase/memories";
import { useTree } from "@/lib/tree-context";

export default function MemoryAlbumSettingsPage() {
  const params = useParams<{ id: string }>();
  const { getMemory, isLoading, error, updateMemory: updateCachedMemory } = useMemories();
  const {
    albumAppearance: defaultAppearance,
    albumAppearanceReady,
    albumAppearanceLoading,
    albumAppearanceError,
    reloadAlbumAppearance,
  } = usePreferences();
  const tree = useTree();
  const memory = getMemory(params.id);
  const [individualAppearance, setIndividualAppearance] = useState<AlbumAppearance | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inheritedAppearanceUnavailable = !memory?.albumAppearance && !albumAppearanceReady;

  useEffect(() => {
    setIndividualAppearance(memory?.albumAppearance ?? null);
  }, [memory?.albumAppearance, memory?.id]);

  const handleAppearanceChange = async (next: AlbumAppearance) => {
    if (!memory || saving) return;
    const previous = individualAppearance;
    setIndividualAppearance(next);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateMemoryAlbumAppearance(createClient(), memory.id, next);
      setIndividualAppearance(saved);
      updateCachedMemory({ ...memory, albumAppearance: saved });
    } catch (cause) {
      setIndividualAppearance(previous);
      setSaveError(cause instanceof Error ? cause.message : "個別の見た目を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

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
        <AlbumSettingsPanel
          memory={memory}
          contextual
          appearance={individualAppearance ?? defaultAppearance}
          onAppearanceChange={(next) => void handleAppearanceChange(next)}
          loading={inheritedAppearanceUnavailable && albumAppearanceLoading}
          saving={saving}
          controlsDisabled={inheritedAppearanceUnavailable}
          saveError={saveError ?? (inheritedAppearanceUnavailable ? albumAppearanceError : null)}
          onRetry={inheritedAppearanceUnavailable && !albumAppearanceLoading ? () => void reloadAlbumAppearance() : undefined}
          harvestWord={tree.harvestWordFor(memory.id)}
        />
      ) : (
        <p className="mt-12 text-center text-sm text-ink/55">思い出が見つかりません。</p>
      )}
    </div>
  );
}
