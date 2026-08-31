import type { Memory } from "./types";

// Seven recent memories rest in the cup. Each additional upload releases
// exactly one older memory; unanswered releases are never discarded.
export const TEA_QUEUE_SIZE = 7;
export const MONTHLY_SIPS = 15;
export type TeaSip = { memoryId: string; month: string; correct: boolean };
export type TeaRollover = { from: string; to: string; remaining: number; carried: number };
export type TeaState = {
  version: 1;
  month: string;
  seen: string[];
  pearls: string[];
  sips: TeaSip[];
  rollover: TeaRollover | null;
};

export function localMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return `${year + (value === 12 ? 1 : 0)}-${String(value === 12 ? 1 : value + 1).padStart(2, "0")}`;
}

export function emptyTea(month: string): TeaState {
  return { version: 1, month, seen: [], pearls: [], sips: [], rollover: null };
}

export function sipCount(state: TeaState) {
  return state.sips.filter((sip) => sip.month === state.month).length;
}

export function teaRemaining(state: TeaState) {
  return Math.max(0, 1 - sipCount(state) / MONTHLY_SIPS);
}

export function readyPearls(state: TeaState) {
  return state.pearls.slice(0, Math.max(0, state.pearls.length - TEA_QUEUE_SIZE));
}

export function rollTeaMonth(state: TeaState, month: string): TeaState {
  // Ignore backward clock changes. Only the drink resets; every pearl and
  // released quiz survives, even when several months have passed.
  if (month <= state.month) return state;
  return { ...state, month, rollover: { from: state.month, to: month, remaining: teaRemaining(state), carried: state.pearls.length } };
}

export function addTeaMemories(state: TeaState, memories: Memory[]): TeaState {
  const seen = new Set(state.seen);
  const additions = [...memories]
    .sort((a, b) => (a.createdAt ?? a.date).localeCompare(b.createdAt ?? b.date) || a.id.localeCompare(b.id))
    .filter((memory) => {
      if (seen.has(memory.id)) return false;
      seen.add(memory.id);
      return true;
    }).map((memory) => memory.id);
  if (!additions.length) return state;
  return { ...state, seen: [...state.seen, ...additions], pearls: [...state.pearls, ...additions] };
}

export function drinkPearl(state: TeaState, memoryId: string, correct: boolean): TeaState {
  // The oldest released pearl only. Guards double clicks, stale pages and
  // direct navigation to a newer quiz. Wrong answers still recall a memory.
  if (readyPearls(state)[0] !== memoryId || state.rollover) return state;
  return { ...state, pearls: state.pearls.slice(1), sips: [...state.sips, { memoryId, month: state.month, correct }] };
}

const validMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string") && new Set(value).size === value.length;

export function readTeaState(raw: string | null, month: string): TeaState {
  try {
    const data = JSON.parse(raw ?? "null") as TeaState | null;
    if (!data || data.version !== 1 || !validMonth(data.month) || !ids(data.seen) || !ids(data.pearls) || !Array.isArray(data.sips)) return emptyTea(month);
    if (!data.sips.every((sip) => sip && typeof sip.memoryId === "string" && validMonth(sip.month) && typeof sip.correct === "boolean")) return emptyTea(month);
    const consumed = data.sips.map((sip) => sip.memoryId);
    if (new Set(consumed).size !== consumed.length || data.pearls.some((id) => !data.seen.includes(id) || consumed.includes(id)) || consumed.some((id) => !data.seen.includes(id))) return emptyTea(month);
    const event = data.rollover;
    if (event && (!validMonth(event.from) || !validMonth(event.to) || event.to !== data.month || typeof event.remaining !== "number" || event.remaining < 0 || event.remaining > 1 || !Number.isInteger(event.carried) || event.carried < 0)) return emptyTea(month);
    return rollTeaMonth(data, month);
  } catch { return emptyTea(month); }
}

export function memoryWord(memory: Memory) {
  return memory.tags.find((tag) => !/^\d+月$/.test(tag)) ?? memory.caption.slice(0, 10);
}

export function teaQuestion(memory: Memory) {
  const [year, month] = memory.date.split("-").map(Number);
  const label = (offset: number) => {
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };
  const choices = [label(-1), label(0), label(1)];
  const rotation = [...memory.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 3;
  return { id: `tea-${memory.id}`, memoryId: memory.id, question: "この一枚を残したのは、いつ？", choices: [...choices.slice(rotation), ...choices.slice(0, rotation)], correctChoice: label(0), hint: memory.people.length ? `${memory.people.join("、")}と過ごした日。` : "写真の光や、季節の気配を思い出して。" };
}
