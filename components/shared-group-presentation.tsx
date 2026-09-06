"use client";

import { useCallback, useEffect, useState } from "react";
import { setBrowserSessionItem } from "@/lib/browser-session-data";

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
const STORAGE_PREFIX = "memorimber-shared-group-presentation-v1:";
const PRESENTATION_EVENT = "memorimber:shared-group-presentation";
const DATA_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,/;

type PresentationEventDetail = {
  groupId: string;
  presentation: SharedGroupPresentation;
};

function storageKey(groupId: string) {
  return `${STORAGE_PREFIX}${groupId}`;
}

function normalizePresentation(value: unknown): SharedGroupPresentation {
  if (!value || typeof value !== "object") return { ...DEFAULT_PRESENTATION };
  const candidate = value as Partial<SharedGroupPresentation>;
  const count = (input: unknown, fallback: number) => Number.isInteger(input) && Number(input) >= 0 && Number(input) <= 10
    ? Number(input)
    : fallback;
  const seconds = candidate.quizSecondsPerQuestion;
  return {
    iconDataUrl: typeof candidate.iconDataUrl === "string" && DATA_IMAGE_PATTERN.test(candidate.iconDataUrl)
      ? candidate.iconDataUrl
      : null,
    showCaption: candidate.showCaption === true,
    showDate: candidate.showDate === true,
    quizMode: candidate.quizMode === "custom" ? "custom" : "random",
    balanceQuizContributors: candidate.balanceQuizContributors === true,
    quizMonthCount: count(candidate.quizMonthCount, DEFAULT_PRESENTATION.quizMonthCount),
    quizPhotoToCaptionCount: count(candidate.quizPhotoToCaptionCount, DEFAULT_PRESENTATION.quizPhotoToCaptionCount),
    quizCaptionToPhotoCount: count(candidate.quizCaptionToPhotoCount, DEFAULT_PRESENTATION.quizCaptionToPhotoCount),
    quizSecondsPerQuestion: seconds === 3 || seconds === 10 ? seconds : 5,
  };
}

function readPresentation(groupId: string) {
  try {
    const saved = window.sessionStorage.getItem(storageKey(groupId));
    return saved ? normalizePresentation(JSON.parse(saved)) : { ...DEFAULT_PRESENTATION };
  } catch {
    return { ...DEFAULT_PRESENTATION };
  }
}

export function useSharedGroupPresentation(groupId: string) {
  const [presentation, setPresentation] = useState<SharedGroupPresentation>({ ...DEFAULT_PRESENTATION });

  useEffect(() => {
    setPresentation(readPresentation(groupId));
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<PresentationEventDetail>).detail;
      if (detail?.groupId === groupId) setPresentation(normalizePresentation(detail.presentation));
    };
    window.addEventListener(PRESENTATION_EVENT, receive);
    return () => window.removeEventListener(PRESENTATION_EVENT, receive);
  }, [groupId]);

  const updatePresentation = useCallback((patch: Partial<SharedGroupPresentation>) => {
    const next = normalizePresentation({ ...readPresentation(groupId), ...patch });
    let persisted = false;
    try {
      persisted = setBrowserSessionItem(window.sessionStorage, storageKey(groupId), JSON.stringify(next));
    } catch {
      // The current screen can still preview the setting when browser storage is unavailable.
    }
    setPresentation(next);
    window.dispatchEvent(new CustomEvent<PresentationEventDetail>(PRESENTATION_EVENT, {
      detail: { groupId, presentation: next },
    }));
    return persisted;
  }, [groupId]);

  return { presentation, updatePresentation };
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
