export type NotificationPreferences = {
  harvest_enabled: boolean;
  anniversary_enabled: boolean;
  weekdays: number[];
};

export function defaultNotificationPreferences(): NotificationPreferences {
  return { harvest_enabled: true, anniversary_enabled: true, weekdays: [0, 1, 2, 3, 4, 5, 6] };
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<NotificationPreferences>;
  if (typeof input.harvest_enabled !== "boolean" || typeof input.anniversary_enabled !== "boolean"
    || !Array.isArray(input.weekdays) || input.weekdays.length > 7
    || !input.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    || new Set(input.weekdays).size !== input.weekdays.length) return null;
  return {
    harvest_enabled: input.harvest_enabled, anniversary_enabled: input.anniversary_enabled,
    weekdays: [...input.weekdays].sort((a, b) => a - b),
  };
}

export function receivesRemindersOn(preferences: NotificationPreferences, date: string) {
  return (preferences.harvest_enabled || preferences.anniversary_enabled)
    && preferences.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
}
