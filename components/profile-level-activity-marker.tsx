"use client";

import { useEffect } from "react";
import { useProfileLevel } from "@/lib/profile-level-context";
import type { LevelActivityMetric } from "@/lib/profile-data";

export function ProfileLevelActivityMarker({
  metric,
  eventId,
  amount,
}: {
  metric: LevelActivityMetric;
  eventId: string;
  amount?: number;
}) {
  const { ready, recordActivity } = useProfileLevel();

  useEffect(() => {
    if (!ready) return;
    recordActivity(metric, { eventId, amount });
  }, [amount, eventId, metric, ready, recordActivity]);

  return null;
}

export function ProfileLevelActivityTotalsMarker({ values }: { values: Partial<Record<LevelActivityMetric, number>> }) {
  const { ready, setActivityTotals } = useProfileLevel();
  const serializedValues = JSON.stringify(values);

  useEffect(() => {
    if (!ready) return;
    setActivityTotals(JSON.parse(serializedValues) as Partial<Record<LevelActivityMetric, number>>);
  }, [ready, serializedValues, setActivityTotals]);

  return null;
}
