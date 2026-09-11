import type { Memory } from "./types";
import type { MemoryTreeItem } from "./tree-data";

export type Reminder = { type: "harvest" | "anniversary"; candidateId: string | null; title: string; body: string; href: string };
export type ReminderMemory = Pick<Memory, "id" | "date">;

function stableHash(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function reminderDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function selectMemoryReminder(userId: string, date: string, memories: ReminderMemory[], items: Pick<MemoryTreeItem, "stage">[]): Reminder | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return null;
  const [year, month, day] = date.split("-").map(Number);
  const groups: Reminder[][] = [];
  // Both production and preview pass the existing Tree's computed items.
  if (items.some((item) => item.stage === "quiz-ready")) groups.push([{
    type: "harvest", candidateId: null, title: "思い出の木",
    body: "収穫できる実が育っています。あの日のことを思い出してみませんか？", href: "/",
  }]);
  const anniversaries: Reminder[] = [];
  for (let yearsAgo = 1; yearsAgo <= 3; yearsAgo++) {
    const targetYear = year - yearsAgo;
    const targetDay = Math.min(day, new Date(Date.UTC(targetYear, month, 0)).getUTCDate());
    const center = Date.UTC(targetYear, month - 1, targetDay);
    for (const memory of memories) {
      const distance = Math.abs(Date.parse(`${memory.date}T00:00:00Z`) - center);
      if (distance <= 7 * 86400000) anniversaries.push({
        type: "anniversary", candidateId: memory.id, title: `${yearsAgo}年前のこの頃`,
        body: "この頃に残した思い出があります。少し振り返ってみませんか？", href: `/memory/${encodeURIComponent(memory.id)}`,
      });
    }
  }
  if (anniversaries.length) groups.push(anniversaries.sort((a, b) => a.title.localeCompare(b.title) || a.candidateId!.localeCompare(b.candidateId!)));
  if (!groups.length) return null;
  // Alternate categories across days when both exist, independently of photo count.
  const group = groups[(stableHash(userId) + Math.floor(Date.parse(date) / 86400000)) % groups.length];
  return group[stableHash(`${userId}:${date}`) % group.length];
}

export function reminderPayload(reminder: Reminder) {
  return { title: reminder.title, body: reminder.body, href: reminder.href };
}
