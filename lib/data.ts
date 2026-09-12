import { AlbumMonth, Memory, QuizQuestion } from "./types";

// Bundle demo artwork so sample memories remain visible without network access.
// Keeping distinct files also makes albums and photo quizzes easy to tell apart.
const photo = (name: string) => `/images/demo/${name}.svg`;

export const SAMPLE_MEMORIES: Memory[] = [
  {
    id: "memory-ice-cream",
    date: "2026-08-12",
    imageUrl: photo("ice-cream"),
    caption: "帰り道、みんなでアイスを食べた",
    people: ["友達"],
    tags: ["放課後", "8月"],
    letter: "夕日がまぶしくて、アイスはすぐに溶けてしまったね。何でもない帰り道だったけれど、みんなで笑った時間をずっと覚えていたい。",
  },
  {
    id: "memory-classroom",
    date: "2026-08-10",
    imageUrl: photo("classroom"),
    caption: "放課後の教室、他愛ない話でずっと笑った。",
    people: ["クラスのみんな"],
    tags: ["放課後", "教室"],
  },
  {
    id: "memory-sports",
    date: "2026-08-08",
    imageUrl: photo("sports"),
    caption: "体育祭の練習で、少しだけ息が合った。",
    people: ["クラスのみんな"],
    tags: ["体育祭", "8月"],
  },
  {
    id: "memory-sunset",
    date: "2026-08-05",
    imageUrl: photo("sunset"),
    caption: "夕焼けがきれいだったから、いつもの道を撮った。",
    people: [],
    tags: ["帰り道", "8月"],
  },
  {
    id: "memory-lunch",
    date: "2026-08-02",
    imageUrl: photo("lunch"),
    caption: "お昼休みに見つけた、夏っぽい色。",
    people: ["友達"],
    tags: ["昼休み", "8月"],
  },
  {
    id: "memory-july-rain",
    date: "2026-07-24",
    imageUrl: photo("rain"),
    caption: "雨の日は、廊下の音まで覚えている。",
    people: [],
    tags: ["雨", "7月"],
  },
  {
    id: "memory-july-cafe",
    date: "2026-07-18",
    imageUrl: photo("cafe"),
    caption: "テスト終わりの寄り道は、いつもより甘い。",
    people: ["友達"],
    tags: ["テスト", "7月"],
  },
  {
    id: "memory-june-sky",
    date: "2026-06-30",
    imageUrl: photo("sky"),
    caption: "新しいクラスにも、少し慣れてきた。",
    people: ["クラスのみんな"],
    tags: ["空", "6月"],
  },
];

export const ALBUM_MONTHS: AlbumMonth[] = [
  { key: "2026-08", label: "2026年8月", message: "夏の終わりにも、ちゃんと日常があった。" },
  { key: "2026-07", label: "2026年7月", message: "暑さの中で、少しずつ距離が近くなった。" },
  { key: "2026-06", label: "2026年6月", message: "新しい毎日を、ゆっくり覚えた月。" },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "quiz-ice-cream",
    memoryId: "memory-ice-cream",
    question: "これはいつの思い出？",
    choices: ["2026年6月", "2026年7月", "2026年8月"],
    correctChoice: "2026年8月",
    hint: "帰り道に、冷たいものを食べた日。",
  },
  {
    id: "quiz-classroom",
    memoryId: "memory-classroom",
    question: "この写真を撮った場所は？",
    choices: ["放課後の教室", "駅前の公園", "家のリビング"],
    correctChoice: "放課後の教室",
    hint: "黒板の前で、話が止まらなかった日。",
  },
];

export const getMonthKey = (date: string) => date.slice(0, 7);

export const formatJapaneseDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
};

export const formatShortDate = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
};
