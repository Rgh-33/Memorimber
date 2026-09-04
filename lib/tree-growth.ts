import type { Memory, QuizQuestion } from "./types";
import type { MemoryTreeItem } from "./tree-data";
import type { MemoryFruits } from "./supabase/memory-fruits";

export type GrowthStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Harvest = { word: string; harvestedAt: string };
export type Harvests = Record<string, Harvest>;
export type HarvestedItem = Extract<MemoryTreeItem, { stage: "harvested" }>;
const LATER_UPLOADS_TO_HARVEST = 7;

/** The album keeps the word as harvest history even after its home-screen
 * petal has finished floating. Preview harvests use the same lookup contract. */
export function getHarvestWordForMemory(memoryId: string, harvests: Harvests, fruits: MemoryFruits) {
  const previewWord = harvests[memoryId]?.word.trim();
  if (previewWord) return previewWord;
  const fruit = fruits[memoryId];
  const savedWord = fruit?.harvestedAt ? fruit.harvestWord?.trim() : "";
  return savedWord || null;
}

export function buildPetals(memories: Memory[], date: string, harvests: Harvests): HarvestedItem[] {
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()]
    .filter((memory) => uploadDate(memory) <= date && harvests[memory.id]?.harvestedAt.slice(0, 10) <= date)
    .sort((a, b) => harvests[a.id].harvestedAt.localeCompare(harvests[b.id].harvestedAt) || a.id.localeCompare(b.id))
    .map((memory, wordSlot) => ({ id: memory.id, memoryId: memory.id, stage: "harvested", word: harvests[memory.id].word,
      wordSlot, harvestedAt: harvests[memory.id].harvestedAt, relatedMemoryIds: [memory.id] }));
}

/** Real fruit state is authoritative from Supabase. Visual growth between
 * uploads remains derived, but ripeness and harvest are never inferred here. */
export function buildPersistedTreeItems(memories: Memory[], date: string, fruits: MemoryFruits): MemoryTreeItem[] {
  const queue = monthlyQueue(memories, date);
  return queue.map((memory, index) => {
    const laterUploads = queue.length - index - 1;
    const fruit = fruits[memory.id];
    if (fruit?.harvestedAt) {
      return { id: memory.id, memoryId: memory.id, stage: "harvested", word: fruit.harvestWord ?? "",
        wordSlot: index, relatedMemoryIds: [memory.id] };
    }

    const ripe = Boolean(fruit?.ripenedAt);
    const growthStage = (ripe ? 7 : Math.min(6, laterUploads + 1)) as GrowthStage;
    const common = {
      id: memory.id,
      memoryId: memory.id,
      fruitSlot: index,
      fruitTone: "peach" as const,
      growthStage,
      newlyAdded: laterUploads === 0,
      newlyFruited: laterUploads === 5,
      newlyRipened: ripe && laterUploads === LATER_UPLOADS_TO_HARVEST,
    };
    return ripe
      ? { ...common, stage: "quiz-ready", growth: 1, href: `/quiz?memory=${encodeURIComponent(memory.id)}` }
      : { ...common, stage: "growing", growth: (growthStage - 1) / 6 };
  });
}

export function buildPersistedPetals(memories: Memory[], date: string, fruits: MemoryFruits, now: number): HarvestedItem[] {
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()]
    .filter((memory) => {
      const fruit = fruits[memory.id];
      return uploadDate(memory) <= date
        && Boolean(fruit?.harvestedAt && fruit.harvestWord && fruit.homeVisibleUntil)
        && Date.parse(fruit.homeVisibleUntil!) > now;
    })
    .sort((a, b) => fruits[a.id].harvestedAt!.localeCompare(fruits[b.id].harvestedAt!) || a.id.localeCompare(b.id))
    .map((memory, wordSlot) => ({ id: memory.id, memoryId: memory.id, stage: "harvested",
      word: fruits[memory.id].harvestWord!, wordSlot, harvestedAt: fruits[memory.id].harvestedAt!, relatedMemoryIds: [memory.id] }));
}

/** Growth flags describe what the latest upload changed in the data. They are
 * presented only while that exact upload is arriving, so revisiting the tree
 * cannot replay a photo being absorbed. */
export function applyUploadPresentation(items: MemoryTreeItem[], arrivingMemoryId: string | null) {
  const hasArrival = Boolean(arrivingMemoryId && items.some((item) => item.id === arrivingMemoryId && item.newlyAdded));
  return items.map((item) => {
    if (item.stage === "harvested") return item;
    const newlyAdded = hasArrival && item.id === arrivingMemoryId;
    const newlyFruited = hasArrival && !newlyAdded && item.newlyFruited === true;
    const newlyRipened = hasArrival && !newlyAdded && item.newlyRipened === true;
    const growthStage = item.growthStage ?? 1;
    return {
      ...item,
      newlyAdded,
      newlyFruited,
      newlyRipened,
      advancedThisUpload: hasArrival && !newlyAdded && !newlyFruited && !newlyRipened
        && growthStage >= 2 && growthStage <= 6,
    };
  });
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function tokyoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function advanceDate(date: string, days = 0, months = 0) {
  const [year, month, day] = date.split("-").map(Number);
  // Noon avoids DST gaps; month stepping clamps Aug 31 to Sep 30.
  const target = new Date(year, month - 1 + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay) + days);
  return localDate(target);
}

export function uploadDate(memory: Memory) {
  return memory.createdAt ? tokyoDate(new Date(memory.createdAt)) : memory.date;
}

export function monthlyQueue(memories: Memory[], date: string) {
  // Photo dates can be backdated. Growth follows successful uploads, not the
  // date chosen in the album. Deduplication also makes refresh/recovery safe.
  return [...new Map(memories.map((memory) => [memory.id, memory])).values()]
    .filter((memory) => uploadDate(memory).slice(0, 7) === date.slice(0, 7) && uploadDate(memory) <= date)
    .sort((a, b) => (a.createdAt ?? a.date).localeCompare(b.createdAt ?? b.date) || a.id.localeCompare(b.id));
}

export function buildTreeItems(memories: Memory[], date: string, harvests: Harvests): MemoryTreeItem[] {
  const queue = monthlyQueue(memories, date);
  return queue.map((memory, index) => {
    const laterUploads = queue.length - index - 1;
    const ripe = laterUploads >= LATER_UPLOADS_TO_HARVEST;
    // The original upload creates this photo's leaf. Seven *later* uploads
    // ripen it; until then it remains at most a small fruit (visual stage 6).
    const growthStage = (ripe ? 7 : Math.min(6, laterUploads + 1)) as GrowthStage;
    const harvest = harvests[memory.id];
    if (harvest && harvest.harvestedAt.slice(0, 10) <= date) {
      return { id: memory.id, memoryId: memory.id, stage: "harvested", word: harvest.word,
        wordSlot: index, relatedMemoryIds: [memory.id] };
    }
    const common = {
      id: memory.id,
      memoryId: memory.id,
      fruitSlot: index,
      fruitTone: "peach" as const,
      growthStage,
      newlyAdded: laterUploads === 0,
      newlyFruited: laterUploads === 5,
      newlyRipened: laterUploads === LATER_UPLOADS_TO_HARVEST,
    };
    return ripe
      ? { ...common, stage: "quiz-ready", growth: 1, href: `/quiz?memory=${encodeURIComponent(memory.id)}` }
      : { ...common, stage: "growing", growth: (growthStage - 1) / 6 };
  });
}

export function recordHarvest(memories: Memory[], date: string, harvests: Harvests, id: string, word: string): Harvests {
  const trimmed = word.trim();
  if (!trimmed || [...trimmed].length > 12 || harvests[id]) return harvests;
  if (!buildTreeItems(memories, date, harvests).some((item) => item.id === id && item.stage === "quiz-ready")) return harvests;
  return { ...harvests, [id]: { word: trimmed, harvestedAt: `${date}T12:00:00` } };
}

export function memoryQuestion(memory: Memory): QuizQuestion {
  const month = memory.date.slice(0, 7);
  const label = (date: string) => `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;
  const correctChoice = label(month);
  const choices = [label(advanceDate(`${month}-01`, 0, -1)), correctChoice, label(advanceDate(`${month}-01`, 0, 1))];
  const offset = [...memory.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % choices.length;
  return { id: `quiz-${memory.id}`, memoryId: memory.id, question: "これはいつの思い出？",
    choices: [...choices.slice(offset), ...choices.slice(0, offset)], correctChoice, hint: memory.caption };
}

/** One selected fruit resolves to one photo and one question. Never substitute
 * another ripe fruit or a sample if the requested fruit cannot be harvested. */
export function getFruitQuiz(memories: Memory[], items: MemoryTreeItem[], memoryId: string | null) {
  if (!memoryId || !items.some((item) => item.stage === "quiz-ready" && item.memoryId === memoryId)) return null;
  const memory = memories.find((candidate) => candidate.id === memoryId);
  return memory ? { memory, question: memoryQuestion(memory) } : null;
}
