import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryFruit = {
  memoryId: string;
  ripenedAt: string | null;
  harvestedAt: string | null;
  harvestWord: string | null;
  wordAssignedAt: string | null;
  homeVisibleUntil: string | null;
};

export type MemoryFruits = Record<string, MemoryFruit>;

type MemoryFruitRow = {
  memory_id: string;
  ripened_at: string | null;
  harvested_at: string | null;
  harvest_word: string | null;
  word_assigned_at: string | null;
  home_visible_until: string | null;
};

const SELECT_COLUMNS = "memory_id, ripened_at, harvested_at, harvest_word, word_assigned_at, home_visible_until";

function errorDetail(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "通信状態を確認して、もう一度お試しください。";
}

function toMemoryFruit(row: MemoryFruitRow): MemoryFruit {
  return {
    memoryId: row.memory_id,
    ripenedAt: row.ripened_at,
    harvestedAt: row.harvested_at,
    harvestWord: row.harvest_word,
    wordAssignedAt: row.word_assigned_at,
    homeVisibleUntil: row.home_visible_until,
  };
}

export async function loadMemoryFruits(client: SupabaseClient): Promise<MemoryFruits> {
  const rows: MemoryFruitRow[] = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("memory_fruits")
      .select(SELECT_COLUMNS)
      .order("memory_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`木の実の状態を読み込めませんでした。${errorDetail(error)}`);
    const page = (data ?? []) as MemoryFruitRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return Object.fromEntries(rows.map((row) => {
    const fruit = toMemoryFruit(row);
    return [fruit.memoryId, fruit];
  }));
}

export async function completeMemoryHarvest(client: SupabaseClient, memoryId: string, word: string) {
  const normalizedWord = word.trim();
  if (!normalizedWord || [...normalizedWord].length > 12) {
    throw new Error("ひと単語は1〜12文字で入力してください。");
  }

  const { data, error } = await client.rpc("complete_memory_harvest", {
    p_memory_id: memoryId,
    p_word: normalizedWord,
  });
  if (error) throw new Error(`木の実を収穫できませんでした。${errorDetail(error)}`);

  const row = (Array.isArray(data) ? data[0] : data) as MemoryFruitRow | null;
  if (!row?.memory_id) throw new Error("収穫後の木の実を確認できませんでした。再読み込みしてください。");
  return toMemoryFruit(row);
}
