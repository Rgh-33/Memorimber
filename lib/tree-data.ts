export type MemoryTreeStage = "growing" | "quiz-ready" | "harvested";

export type MemoryFruitTone = "blue" | "mint" | "peach" | "lavender" | "lemon" | "rose";

type MemoryTreeItemBase = {
  id: string;
  memoryId?: string;
};

export type MemoryTreeItem =
  | (MemoryTreeItemBase & {
      stage: "growing";
      fruitSlot: number;
      fruitTone: MemoryFruitTone;
      growth: number;
      word?: never;
      wordSlot?: never;
      href?: never;
    })
  | (MemoryTreeItemBase & {
      stage: "quiz-ready";
      fruitSlot: number;
      fruitTone: MemoryFruitTone;
      growth: 1;
      href: string;
      word?: never;
      wordSlot?: never;
    })
  | (MemoryTreeItemBase & {
      stage: "harvested";
      word: string;
      wordSlot: number;
      href?: string;
      fruitSlot?: never;
      fruitTone?: never;
      growth?: never;
    });

// UI確認用データ。将来は、投稿・成長時間・クイズ完了状態から同じ形へ変換する。
export const TREE_PREVIEW_ITEMS: MemoryTreeItem[] = [
  { id: "word-yukimi", stage: "harvested", word: "雪見だいふく", wordSlot: 0 },
  { id: "word-lasagna", stage: "harvested", word: "ラザニア", wordSlot: 1 },
  { id: "word-curry", stage: "harvested", word: "カレー", wordSlot: 2 },
  { id: "word-umbrella", stage: "harvested", word: "赤い傘", wordSlot: 3 },
  { id: "word-muffler", stage: "harvested", word: "青いマフラー", wordSlot: 4 },
  { id: "word-bottle", stage: "harvested", word: "銀色の水筒", wordSlot: 5 },
  { id: "word-sunset", stage: "harvested", word: "夕焼け", wordSlot: 6 },
  { id: "word-after-school", stage: "harvested", word: "放課後", wordSlot: 7 },
  { id: "word-classroom", stage: "harvested", word: "教室", wordSlot: 8 },
  { id: "word-sports-day", stage: "harvested", word: "体育祭", wordSlot: 9 },
  { id: "word-rain", stage: "harvested", word: "雨の音", wordSlot: 10 },
  { id: "word-detour", stage: "harvested", word: "寄り道", wordSlot: 11 },
  { id: "fruit-blue", stage: "growing", fruitSlot: 0, fruitTone: "blue", growth: 0.42 },
  { id: "fruit-mint", stage: "quiz-ready", fruitSlot: 1, fruitTone: "mint", growth: 1, href: "/quiz" },
  { id: "fruit-peach", stage: "growing", fruitSlot: 2, fruitTone: "peach", growth: 0.68 },
  { id: "fruit-lavender", stage: "quiz-ready", fruitSlot: 3, fruitTone: "lavender", growth: 1, href: "/quiz" },
  { id: "fruit-lemon", stage: "growing", fruitSlot: 4, fruitTone: "lemon", growth: 0.3 },
  { id: "fruit-rose", stage: "quiz-ready", fruitSlot: 5, fruitTone: "rose", growth: 1, href: "/quiz" },
];
