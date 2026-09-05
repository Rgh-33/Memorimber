"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlbumSettingsPanel } from "@/components/album-settings-panel";
import { SettingsHeader } from "@/components/settings-header";
import type { AlbumAppearance } from "@/lib/album-appearance";
import { useMemories } from "@/lib/memories-context";
import { usePreferences } from "@/lib/preferences-context";
import { createClient } from "@/lib/supabase/client";
import { loadMemory, updateMemoryAlbumAppearance } from "@/lib/supabase/memories";
import { useTree } from "@/lib/tree-context";
import type { Memory } from "@/lib/types";

export default function MemoryAlbumSettingsPage() {
  const params = useParams<{ id: string }>();
  const { getMemory, isLoading, error, isDemo, updateMemory: updateCachedMemory } = useMemories();
  const {
    albumAppearance: defaultAppearance,
    albumAppearanceReady,
    albumAppearanceLoading,
    albumAppearanceError,
    reloadAlbumAppearance,
  } = usePreferences();
  const tree = useTree();
  const cachedMemory = getMemory(params.id);
  const [loadedMemory, setLoadedMemory] = useState<Memory | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(!isDemo);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const memory = isDemo ? cachedMemory : loadedMemory ?? undefined;
  const [individualAppearance, setIndividualAppearance] = useState<AlbumAppearance | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inheritedAppearanceUnavailable = !memory?.albumAppearance && !albumAppearanceReady;

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    setMemoryLoading(true);
    setMemoryError(null);
    setLoadedMemory(null);
    void loadMemory(createClient(), params.id).then((result) => {
      if (!active) return;
      setLoadedMemory(result?.memory ?? null);
      if (!result) setMemoryError("思い出が見つかりません。");
    }).catch((cause) => {
      if (!active) return;
      setMemoryError(cause instanceof Error ? cause.message : "思い出を読み込めませんでした。");
    }).finally(() => {
      if (active) setMemoryLoading(false);
    });
    return () => { active = false; };
  }, [isDemo, params.id]);

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
      setLoadedMemory((current) => current ? { ...current, albumAppearance: saved } : current);
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

      {(isDemo ? isLoading : memoryLoading) && !memory ? (
        <p role="status" className="mt-12 text-center text-sm text-ink/55">思い出を読み込んでいます…</p>
      ) : (isDemo ? error : memoryError) && !memory ? (
        <p role="alert" className="mt-12 rounded-xl border border-line p-4 text-sm leading-6 text-ink">{isDemo ? error : memoryError}</p>
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
