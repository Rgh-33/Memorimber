import type { SupabaseClient } from "@supabase/supabase-js";
import { isAlbumAppearance } from "../album-appearance.ts";
import type { Memory } from "../types";
import { MEMORY_IMAGE_BUCKET, MEMORY_IMAGE_URL_LIFETIME } from "./memories.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMORY_COLUMNS = "id, user_id, image_path, caption, memory_date, people, tags, letter, album_appearance, created_at, updated_at";
const SHARED_MEMORY_COLUMNS = `album_id, memory_id, added_by, created_at, memory:memories!inner(${MEMORY_COLUMNS})`;

export type SharedAlbum = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type SharedAlbumMember = {
  userId: string;
  displayName: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type SharedAlbumMemoryEntry = {
  albumId: string;
  addedBy: string;
  addedAt: string;
  memoryOwnerId: string;
  memory: Memory;
};

export type SharedAlbumMemoryResult = {
  entries: SharedAlbumMemoryEntry[];
  warning: string | null;
};

export type SharedMemoryChoice = Pick<Memory, "id" | "date" | "caption">;

type AlbumRow = { id: string; owner_id: string; name: string; created_at: string; updated_at: string };
type MemoryRow = {
  id: string;
  user_id: string;
  image_path: string;
  caption: string;
  memory_date: string;
  people: string[];
  tags: string[];
  letter?: string | null;
  album_appearance?: unknown;
  created_at?: string;
};

type SharedMemoryRow = {
  album_id: string;
  memory_id: string;
  added_by: string;
  created_at: string;
  memory: MemoryRow | MemoryRow[];
};

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "通信状態を確認して、もう一度お試しください。";
}

function albumError(error: unknown, fallback: string) {
  const message = errorMessage(error);
  if (message.includes("shared album owner cannot leave")) return "オーナーはグループから退出できません。グループを削除してください。";
  if (message.includes("only the shared album owner")) return "この操作を行えるのはグループのオーナーだけです。";
  if (message.includes("shared album membership not found")) return "メンバーが見つからないか、すでに退出しています。";
  if (message.includes("shared album not found")) return "グループが見つからないか、閲覧する権限がありません。";
  if (message.includes("duplicate key") || message.includes("shared_album_memories_pkey")) return "この思い出はすでに共有されています。";
  return `${fallback}${message}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function requireUuid(value: unknown, label: string) {
  if (!isUuid(value)) throw new Error(`${label}が正しくありません。`);
  return value;
}

export function normalizeSharedAlbumName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("グループ名を入力してください。");
  if ([...name].length > 60) throw new Error("グループ名は60文字以内で入力してください。");
  return name;
}

function toAlbum(row: AlbumRow): SharedAlbum {
  return { id: row.id, ownerId: row.owner_id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toMemory(row: MemoryRow, imageUrl: string): Memory {
  return {
    id: row.id,
    imagePath: row.image_path,
    imageUrl,
    caption: row.caption,
    date: row.memory_date,
    people: Array.isArray(row.people) ? row.people : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    letter: row.letter ?? "",
    albumAppearance: isAlbumAppearance(row.album_appearance) ? row.album_appearance : null,
    createdAt: row.created_at,
  };
}

function singleMemory(value: MemoryRow | MemoryRow[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function listSharedAlbums(client: SupabaseClient): Promise<SharedAlbum[]> {
  const { data, error } = await client.from("shared_albums")
    .select("id, owner_id, name, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new Error(albumError(error, "グループを読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).map((row) => toAlbum(row as AlbumRow));
}

export async function getSharedAlbum(client: SupabaseClient, albumId: string): Promise<SharedAlbum | null> {
  const { data, error } = await client.from("shared_albums")
    .select("id, owner_id, name, created_at, updated_at")
    .eq("id", requireUuid(albumId, "グループ"))
    .maybeSingle();
  if (error) throw new Error(albumError(error, "グループを読み込めませんでした。"));
  return data ? toAlbum(data as AlbumRow) : null;
}

export async function createSharedAlbum(client: SupabaseClient, nameInput: unknown) {
  const name = normalizeSharedAlbumName(nameInput);
  const { data, error } = await client.from("shared_albums")
    .insert({ name })
    .select("id, owner_id, name, created_at, updated_at")
    .single();
  if (error || !data) throw new Error(albumError(error, "グループを作成できませんでした。"));
  return toAlbum(data as AlbumRow);
}

export async function listSharedAlbumMembers(client: SupabaseClient, albumId: string): Promise<SharedAlbumMember[]> {
  const { data, error } = await client.rpc("list_shared_album_members", {
    target_album_id: requireUuid(albumId, "グループ"),
  });
  if (error) throw new Error(albumError(error, "メンバーを読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).flatMap((raw): SharedAlbumMember[] => {
    const row = raw as Record<string, unknown>;
    if (
      typeof row.user_id !== "string"
      || typeof row.display_name !== "string"
      || (row.role !== "owner" && row.role !== "member")
      || typeof row.joined_at !== "string"
    ) return [];
    return [{ userId: row.user_id, displayName: row.display_name, role: row.role, joinedAt: row.joined_at }];
  });
}

export async function listOwnMemoriesForSharing(
  client: SupabaseClient,
  userId: string,
): Promise<SharedMemoryChoice[]> {
  const { data, error } = await client.from("memories")
    .select("id, caption, memory_date")
    .eq("user_id", requireUuid(userId, "ユーザー"))
    .order("memory_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(albumError(error, "自分の思い出を読み込めませんでした。"));
  return (Array.isArray(data) ? data : []).flatMap((raw): SharedMemoryChoice[] => {
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.caption !== "string" || typeof row.memory_date !== "string") return [];
    return [{ id: row.id, caption: row.caption, date: row.memory_date }];
  });
}

async function signMemoryImages(client: SupabaseClient, rows: MemoryRow[]) {
  const urls = new Map<string, string>();
  let warning: string | null = null;
  const pageSize = 100;
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    const paths = rows.slice(offset, offset + pageSize).map((row) => row.image_path);
    try {
      const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
        .createSignedUrls(paths, MEMORY_IMAGE_URL_LIFETIME);
      if (error) throw error;
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
      }
    } catch {
      warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
    }
  }
  if (urls.size !== rows.length) warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
  return { urls, warning };
}

export async function loadSharedAlbumMemoryEntries(
  client: SupabaseClient,
  albumId: string,
): Promise<SharedAlbumMemoryResult> {
  const id = requireUuid(albumId, "グループ");
  const rows: SharedMemoryRow[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("shared_album_memories")
      .select(SHARED_MEMORY_COLUMNS)
      .eq("album_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(albumError(error, "共有された思い出を読み込めませんでした。"));
    const page = (Array.isArray(data) ? data : []) as unknown as SharedMemoryRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const normalized = rows.flatMap((row) => {
    const memory = singleMemory(row.memory);
    return memory ? [{ row, memory }] : [];
  });
  const { urls, warning } = await signMemoryImages(client, normalized.map(({ memory }) => memory));
  return {
    entries: normalized.map(({ row, memory }) => ({
      albumId: row.album_id,
      addedBy: row.added_by,
      addedAt: row.created_at,
      memoryOwnerId: memory.user_id,
      memory: toMemory(memory, urls.get(memory.image_path) ?? ""),
    })),
    warning,
  };
}

/** Quiz-ready memories. The caller can pass this result directly to createQuizQuestions. */
export async function loadSharedAlbumMemories(client: SupabaseClient, albumId: string): Promise<Memory[]> {
  const { entries } = await loadSharedAlbumMemoryEntries(client, albumId);
  return entries.map((entry) => entry.memory);
}

export async function addMemoryToSharedAlbum(client: SupabaseClient, albumId: string, memoryId: string) {
  const { error } = await client.from("shared_album_memories").insert({
    album_id: requireUuid(albumId, "グループ"),
    memory_id: requireUuid(memoryId, "思い出"),
  });
  if (error) throw new Error(albumError(error, "思い出を共有できませんでした。"));
}

export async function removeMemoryFromSharedAlbum(client: SupabaseClient, albumId: string, memoryId: string) {
  const { data, error } = await client.from("shared_album_memories")
    .delete()
    .eq("album_id", requireUuid(albumId, "グループ"))
    .eq("memory_id", requireUuid(memoryId, "思い出"))
    .select("memory_id")
    .maybeSingle();
  if (error) throw new Error(albumError(error, "思い出の共有を解除できませんでした。"));
  if (!data) throw new Error("思い出が見つからないか、共有を解除する権限がありません。");
}

export async function leaveSharedAlbum(client: SupabaseClient, albumId: string, removeSharedMemories: boolean) {
  const { data, error } = await client.rpc("leave_shared_album", {
    target_album_id: requireUuid(albumId, "グループ"),
    remove_shared_memories: removeSharedMemories,
  });
  if (error) throw new Error(albumError(error, "グループから退出できませんでした。"));
  return Number(data ?? 0);
}

export async function removeSharedAlbumMember(client: SupabaseClient, albumId: string, userId: string) {
  const { data, error } = await client.rpc("remove_shared_album_member", {
    target_album_id: requireUuid(albumId, "グループ"),
    target_user_id: requireUuid(userId, "メンバー"),
  });
  if (error) throw new Error(albumError(error, "メンバーを除外できませんでした。"));
  return Number(data ?? 0);
}

export async function deleteSharedAlbum(client: SupabaseClient, albumId: string) {
  const { data, error } = await client.from("shared_albums")
    .delete()
    .eq("id", requireUuid(albumId, "グループ"))
    .select("id")
    .maybeSingle();
  if (error) throw new Error(albumError(error, "グループを削除できませんでした。"));
  if (!data) throw new Error("グループが見つからないか、削除する権限がありません。");
}
