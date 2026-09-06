"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { setBrowserSessionItem } from "@/lib/browser-session-data";
import { useMemories } from "@/lib/memories-context";
import {
  LEVEL_ACTIVITY_METRICS,
  createEmptyLevelActivityStats,
  getProfileLevelProgress,
  resolveProfileLevelAdvancement,
  type LevelActivityBaselines,
  type LevelActivityMetric,
  type LevelActivityStats,
  type ProfileLevelStats,
} from "@/lib/profile-data";

export const PROFILE_LEVEL_STATE_STORAGE_KEY = "memorimber-profile-level-state-v1";
const MAX_RECORDED_EVENTS = 200;

type StoredProfileLevelState = {
  version: 1;
  achievedLevel: number;
  activities: LevelActivityStats;
  baselines: LevelActivityBaselines;
  recordedEvents: string[];
};

type ProfileLevelContextValue = {
  activityTotals: LevelActivityStats;
  levelProgress: ReturnType<typeof getProfileLevelProgress>;
  ready: boolean;
  recordActivity: (metric: LevelActivityMetric, options?: { eventId?: string; amount?: number }) => void;
  setActivityTotals: (values: Partial<LevelActivityStats>) => void;
};

const ProfileLevelContext = createContext<ProfileLevelContextValue | null>(null);

function emptyState(): StoredProfileLevelState {
  return {
    version: 1,
    achievedLevel: 1,
    activities: createEmptyLevelActivityStats(),
    baselines: {},
    recordedEvents: [],
  };
}

function finiteCounter(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function readStoredState(): StoredProfileLevelState {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_LEVEL_STATE_STORAGE_KEY) ?? "null") as Partial<StoredProfileLevelState> | null;
    if (!parsed || parsed.version !== 1) return emptyState();
    const activities = createEmptyLevelActivityStats();
    for (const metric of LEVEL_ACTIVITY_METRICS) activities[metric] = finiteCounter(parsed.activities?.[metric]);
    const baselines: LevelActivityBaselines = {};
    if (parsed.baselines && typeof parsed.baselines === "object") {
      for (const [levelKey, values] of Object.entries(parsed.baselines)) {
        const level = Number(levelKey);
        if (!Number.isInteger(level) || level < 2 || level > 20 || !values || typeof values !== "object") continue;
        const normalized: Partial<Record<LevelActivityMetric, number>> = {};
        for (const metric of LEVEL_ACTIVITY_METRICS) {
          if (typeof values[metric] === "number" && Number.isFinite(values[metric]) && values[metric] >= 0) {
            normalized[metric] = Math.trunc(values[metric]);
          }
        }
        baselines[level] = normalized;
      }
    }
    return {
      version: 1,
      achievedLevel: Math.max(1, Math.min(20, finiteCounter(parsed.achievedLevel) || 1)),
      activities,
      baselines,
      recordedEvents: Array.isArray(parsed.recordedEvents)
        ? parsed.recordedEvents.filter((value): value is string => typeof value === "string").slice(-MAX_RECORDED_EVENTS)
        : [],
    };
  } catch {
    return emptyState();
  }
}

function levelStats(uploadedPhotos: number, activities: LevelActivityStats): ProfileLevelStats {
  return { uploadedPhotos, ...activities };
}

function reconcileState(state: StoredProfileLevelState, uploadedPhotos: number): StoredProfileLevelState {
  const advancement = resolveProfileLevelAdvancement(
    levelStats(uploadedPhotos, state.activities),
    state.achievedLevel,
    state.baselines,
  );
  return { ...state, achievedLevel: advancement.level, baselines: advancement.baselines };
}

export function ProfileLevelProvider({ children }: { children: ReactNode }) {
  const { memories } = useMemories();
  const initialPhotoCount = useRef(memories.length);
  const [state, setState] = useState<StoredProfileLevelState>(emptyState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(reconcileState(readStoredState(), initialPhotoCount.current));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setState((current) => reconcileState(current, memories.length));
  }, [memories.length, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      setBrowserSessionItem(localStorage, PROFILE_LEVEL_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep this visit's progression even when browser storage is unavailable.
    }
  }, [ready, state]);

  const recordActivity = useCallback((metric: LevelActivityMetric, options?: { eventId?: string; amount?: number }) => {
    setState((current) => {
      const eventKey = options?.eventId ? `${metric}:${options.eventId}` : null;
      if (eventKey && current.recordedEvents.includes(eventKey)) return current;
      const amount = Math.max(1, finiteCounter(options?.amount) || 1);
      const next: StoredProfileLevelState = {
        ...current,
        activities: { ...current.activities, [metric]: current.activities[metric] + amount },
        recordedEvents: eventKey
          ? [...current.recordedEvents, eventKey].slice(-MAX_RECORDED_EVENTS)
          : current.recordedEvents,
      };
      return reconcileState(next, memories.length);
    });
  }, [memories.length]);

  const setActivityTotals = useCallback((values: Partial<LevelActivityStats>) => {
    setState((current) => {
      const activities = { ...current.activities };
      let changed = false;
      for (const metric of LEVEL_ACTIVITY_METRICS) {
        if (values[metric] === undefined) continue;
        const value = finiteCounter(values[metric]);
        if (activities[metric] === value) continue;
        activities[metric] = value;
        changed = true;
      }
      return changed ? reconcileState({ ...current, activities }, memories.length) : current;
    });
  }, [memories.length]);

  const stats = useMemo(() => levelStats(memories.length, state.activities), [memories.length, state.activities]);
  const value = useMemo<ProfileLevelContextValue>(() => ({
    activityTotals: state.activities,
    levelProgress: getProfileLevelProgress(stats, state.baselines, state.achievedLevel),
    ready,
    recordActivity,
    setActivityTotals,
  }), [ready, recordActivity, setActivityTotals, state.achievedLevel, state.activities, state.baselines, stats]);

  return <ProfileLevelContext.Provider value={value}>{children}</ProfileLevelContext.Provider>;
}

export function useProfileLevel() {
  const context = useContext(ProfileLevelContext);
  if (!context) throw new Error("useProfileLevel must be used within ProfileLevelProvider");
  return context;
}
