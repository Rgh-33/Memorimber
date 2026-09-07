"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getGroupCache, getEmptyGroupCache, refreshGroup, subscribeGroupCache, watchGroup } from "@/lib/shared-group-cache";
export const MAX_SHARED_GROUP_ICON_BYTES = 5 * 1024 * 1024;
export const SHARED_GROUP_ICON_ACCEPT = "image/jpeg,image/png,image/webp";

export type SharedGroupPresentation = {
  iconDataUrl: string | null;
  showCaption: boolean;
  showDate: boolean;
  quizMode: "random" | "custom";
  balanceQuizContributors: boolean;
  quizMonthCount: number;
  quizPhotoToCaptionCount: number;
  quizCaptionToPhotoCount: number;
  quizSecondsPerQuestion: 3 | 5 | 10;
};

const DEFAULT_PRESENTATION: SharedGroupPresentation = {
  iconDataUrl: null,
  showCaption: false,
  showDate: false,
  quizMode: "random",
  balanceQuizContributors: false,
  quizMonthCount: 0,
  quizPhotoToCaptionCount: 5,
  quizCaptionToPhotoCount: 5,
  quizSecondsPerQuestion: 5,
};

export function useSharedGroupPresentation(groupId: string) {
  const cached = useSyncExternalStore(subscribeGroupCache, () => getGroupCache(groupId), getEmptyGroupCache);
  useEffect(() => watchGroup(groupId, false), [groupId]);
  const updatePresentation = useCallback(async (patch: Partial<SharedGroupPresentation>) => {
    const response = await fetch(`/api/shared-groups/${groupId}/presentation`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!response.ok) throw new Error("表示設定を反映できませんでした。");
    await refreshGroup(groupId, false, true);
  }, [groupId]);
  const uploadIcon = useCallback(async (file: File) => {
    const body = new FormData(); body.set("icon", file);
    const response = await fetch(`/api/shared-groups/${groupId}/presentation`, { method: "POST", body });
    if (!response.ok) throw new Error("グループ画像を反映できませんでした。");
    await refreshGroup(groupId, false, true);
  }, [groupId]);
  return { presentation: cached.presentation ?? DEFAULT_PRESENTATION, updatePresentation, uploadIcon, error: cached.error };
}

export function validateSharedGroupIcon(file: File) {
  return SHARED_GROUP_ICON_ACCEPT.split(",").includes(file.type)
    && file.size > 0
    && file.size <= MAX_SHARED_GROUP_ICON_BYTES;
}

/** Create a compact square preview for this tab only; no bytes leave the browser. */
export async function createSharedGroupIconDataUrl(file: File) {
  if (!validateSharedGroupIcon(file)) {
    throw new Error("グループ画像は5MB以下のJPEG・PNG・WebPを選んでください。");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      image.src = objectUrl;
    });

    const side = 256;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error("画像を読み込めませんでした。");
    }

    const sourceSide = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSide) / 2;
    const sourceY = (image.naturalHeight - sourceSide) / 2;
    context.drawImage(image, sourceX, sourceY, sourceSide, sourceSide, 0, 0, side, side);
    const webp = canvas.toDataURL("image/webp", 0.82);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
