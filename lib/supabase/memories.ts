import type { SupabaseClient } from "@supabase/supabase-js";
import { isAlbumAppearance, type AlbumAppearance } from "../album-appearance.ts";
import { createMemoryThumbnail, MEMORY_THUMBNAIL_FILE_SUFFIX, type GeneratedMemoryThumbnail } from "../memory-thumbnail.ts";
import type { Memory, MemoryInput, MemoryUpdateInput } from "../types";

export const MEMORY_IMAGE_BUCKET = "memory-images";
export const MAX_MEMORY_IMAGE_BYTES = 20 * 1024 * 1024;
export const MEMORY_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
export const MEMORY_IMAGE_URL_LIFETIME = 60 * 60;
export const MAX_MEMORY_LETTER_LENGTH = 400;

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif",
};
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif",
};

export function getMemoryImageType(file: Pick<File, "type" | "name" | "size">) {
  if (file.size === 0) throw new Error("空の画像ファイルは選択できません。");
  if (file.size > MAX_MEMORY_IMAGE_BYTES) throw new Error("写真は20MB以下のファイルを選んでください。");
  // Some iPhone/browser file pickers leave HEIC/HEIF MIME types empty.
  const suppliedType = file.type.toLowerCase();
  const contentType = !suppliedType || suppliedType === "application/octet-stream"
    ? EXTENSION_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""]
    : suppliedType === "image/jpg" ? "image/jpeg" : suppliedType;
  const extension = IMAGE_TYPES[contentType];
  if (!extension) throw new Error("JPEG・PNG・WebP・HEIC・HEIF形式の写真を選んでください。");
  return { contentType, extension };
}

export function validateMemoryFields(input: MemoryUpdateInput) {
  const caption = input.caption.trim();
  if (!caption || [...caption].length > 80) throw new Error("一言は1〜80文字で入力してください。");
  const letter = input.letter?.trim();
  if (letter && [...letter].length > MAX_MEMORY_LETTER_LENGTH) {
    throw new Error(`手紙は${MAX_MEMORY_LETTER_LENGTH}文字以内で入力してください。`);
  }
  const parsedDate = new Date(`${input.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== input.date) {
    throw new Error("日付を正しく入力してください。");
  }
  const strings = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return {
    caption,
    memory_date: input.date,
    people: strings(input.people),
    tags: strings(input.tags),
    ...(input.letter !== undefined ? { letter: letter ?? "" } : {}),
  };
}

export function validateMemoryInput(input: MemoryInput) {
  return {
    ...getMemoryImageType(input.image),
    fields: validateMemoryFields(input),
  };
}

export type PendingMemoryUpload = { id: string; userId: string; imagePath: string; thumbnailPath: string | null };
export type MemorySaveStage = "thumbnail" | "auth" | "upload" | "insert" | "cleanup";
export const PENDING_MEMORY_STORAGE_KEY = "memorimber-pending-memory-upload";

export function readPendingMemoryUpload(storage: Pick<Storage, "getItem">): PendingMemoryUpload | null {
  try {
    const pending = JSON.parse(storage.getItem(PENDING_MEMORY_STORAGE_KEY) ?? "null");
    if (pending && typeof pending.userId === "string" && typeof pending.id === "string"
      && /^[0-9a-f-]{36}$/i.test(pending.id) && /^[0-9a-f-]{36}$/i.test(pending.userId)
      && typeof pending.imagePath === "string"
      && new RegExp(`^${pending.userId}/${pending.id}\\.(jpg|png|webp|heic|heif)$`).test(pending.imagePath)
      && (pending.thumbnailPath === undefined || pending.thumbnailPath === null
        || (typeof pending.thumbnailPath === "string"
          && new RegExp(`^${pending.userId}/thumbnails/${pending.id}(?:${MEMORY_THUMBNAIL_FILE_SUFFIX})?\\.(webp|jpg)$`).test(pending.thumbnailPath)))) {
      return {
        id: pending.id,
        userId: pending.userId,
        imagePath: pending.imagePath,
        thumbnailPath: pending.thumbnailPath ?? null,
      };
    }
  } catch { /* Unavailable or invalid tab-local recovery metadata is not a saved memory. */ }
  return null;
}

export class MemorySaveError extends Error {
  readonly pending: PendingMemoryUpload | null;

  constructor(message: string, pending: PendingMemoryUpload | null = null) {
    super(message);
    this.name = "MemorySaveError";
    this.pending = pending;
  }
}

function createMemoryId() {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

    // randomUUID requires a secure context: localhost works, but an iPhone
    // opening http://192.168.x.x may not expose it. getRandomValues remains
    // available there and supplies the same cryptographic randomness.
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID version 4.
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC UUID variant (10xx).
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  // Do not substitute timestamps or Math.random for a secure identifier.
  throw new MemorySaveError("このブラウザでは安全な保存用IDを生成できません。ブラウザを更新するか、HTTPSで開き直してください。");
}

function errorDetail(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "通信状態を確認して、もう一度お試しください。";
}

async function requireUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new MemorySaveError("ログインを確認できませんでした。再度ログインしてから投稿してください。");
  return data.user;
}

function pendingImagePaths(pending: PendingMemoryUpload) {
  return pending.thumbnailPath ? [pending.imagePath, pending.thumbnailPath] : [pending.imagePath];
}

async function removeUploadedImages(client: SupabaseClient, pending: PendingMemoryUpload, reason: string) {
  try {
    const { error } = await client.storage.from(MEMORY_IMAGE_BUCKET).remove(pendingImagePaths(pending));
    if (error) throw error;
  } catch (error) {
    throw new MemorySaveError(`${reason} アップロード済み画像の削除も完了していません。「保存状態を確認・後片付け」を押してください。削除エラー: ${errorDetail(error)}`, pending);
  }
}

/** Reconcile an uncertain response before deleting anything: a committed row wins.
 * Only this attempt's UUID/path may be cleaned up, never arbitrary caller paths.
 */
export async function recoverMemorySave(client: SupabaseClient, pending: PendingMemoryUpload, allowCleanup = true) {
  let user;
  try {
    user = await requireUser(client);
  } catch (error) {
    throw new MemorySaveError(errorDetail(error), pending);
  }
  const validThumbnailPath = pending.thumbnailPath === null
    || new RegExp(`^${user.id}/thumbnails/${pending.id}(?:${MEMORY_THUMBNAIL_FILE_SUFFIX})?\\.(webp|jpg)$`).test(pending.thumbnailPath);
  if (user.id !== pending.userId || !pending.imagePath.startsWith(`${user.id}/${pending.id}.`)
    || pending.imagePath.split("/").length !== 2 || !validThumbnailPath) {
    throw new MemorySaveError("投稿したアカウントでログインし直してから、保存状態を確認してください。", pending);
  }
  try {
    let { data, error } = await client.from("memories").select("id, image_path, thumbnail_path")
      .eq("user_id", user.id).eq("id", pending.id).maybeSingle();
    if (error && isMissingOptionalMemoryColumnError(error)) {
      ({ data, error } = await client.from("memories").select("id, image_path")
        .eq("user_id", user.id).eq("id", pending.id).maybeSingle());
    }
    if (error) throw error;
    if (data) {
      const row = data as { image_path: string; thumbnail_path?: string | null };
      if (row.image_path !== pending.imagePath
        || (row.thumbnail_path && row.thumbnail_path !== pending.thumbnailPath)
        || (pending.thumbnailPath === null && row.thumbnail_path)) {
        throw new Error("画像の保存先が一致しません。");
      }
      return { saved: true as const, id: pending.id };
    }
  } catch (error) {
    throw new MemorySaveError(`保存結果をまだ確認できません。重複投稿を避けるため、再投稿せず「保存状態を確認・後片付け」を押してください。${errorDetail(error)}`, pending);
  }
  if (!allowCleanup) {
    // A request that lost its response may still be in flight on the server.
    // Absence right now is not evidence of rejection; let the user recheck.
    throw new MemorySaveError("保存結果を確定できません。少し時間をおいて「保存状態を確認・後片付け」を押してください。再投稿はまだ行わないでください。", pending);
  }
  await removeUploadedImages(client, pending, "思い出は保存されていません。");
  return { saved: false as const, id: pending.id };
}

type MemorySaveInput = MemoryInput & { thumbnail?: GeneratedMemoryThumbnail | null };

export async function saveMemory(
  client: SupabaseClient,
  input: MemorySaveInput,
  onStage?: (stage: MemorySaveStage) => void,
  onPending?: (pending: PendingMemoryUpload) => void,
) {
  const { fields, contentType, extension } = validateMemoryInput(input);
  onStage?.("thumbnail");
  const thumbnail = input.thumbnail === undefined ? await createMemoryThumbnail(input.image) : input.thumbnail;
  onStage?.("auth");
  const user = await requireUser(client);
  const id = createMemoryId();
  const pending: PendingMemoryUpload = {
    id,
    userId: user.id,
    imagePath: `${user.id}/${id}.${extension}`,
    thumbnailPath: thumbnail ? `${user.id}/thumbnails/${id}${MEMORY_THUMBNAIL_FILE_SUFFIX}.${thumbnail.extension}` : null,
  };
  let savedThumbnailPath = pending.thumbnailPath;
  const savedMemory = async (): Promise<Memory> => {
    const signedImage = await signMemoryImage(client, savedThumbnailPath ?? pending.imagePath);
    return {
      id,
      imagePath: pending.imagePath,
      imageUrl: savedThumbnailPath ? "" : signedImage.imageUrl,
      thumbnailPath: savedThumbnailPath ?? undefined,
      thumbnailUrl: savedThumbnailPath ? signedImage.imageUrl : undefined,
      caption: fields.caption,
      date: fields.memory_date,
      people: fields.people,
      tags: fields.tags,
      letter: fields.letter ?? "",
      albumAppearance: null,
      // Supabase remains authoritative; this timestamp only keeps the tab-local
      // copy stably ordered until the next intentional full refresh.
      createdAt: new Date().toISOString(),
    };
  };
  // The form journals only these identifiers before upload, so reloads can
  // resume verification. No image bytes, caption, tokens or signed URLs persist.
  onPending?.(pending);

  onStage?.("upload");
  try {
    // storage-js uses the Blob/File MIME type for multipart uploads, not the
    // contentType option. Normalize metadata only; preserve every image byte.
    const uploadFile = new File([input.image], `${id}.${extension}`, { type: contentType });
    const { error } = await client.storage.from(MEMORY_IMAGE_BUCKET).upload(pending.imagePath, uploadFile, {
      contentType, upsert: false,
    });
    if (error) throw error;
  } catch (error) {
    const reason = `写真をアップロードできませんでした。${errorDetail(error)}`;
    const status = Number(error && typeof error === "object" && "statusCode" in error ? error.statusCode : 0);
    // A lost upload response may still create the object. Never insert after
    // an upload error or delete while an ambiguous upload might be in flight.
    if (!status || status >= 500) {
      throw new MemorySaveError(`${reason} 少し時間をおいて「保存状態を確認・後片付け」を押してください。`, pending);
    }
    throw new MemorySaveError(reason);
  }

  if (thumbnail && pending.thumbnailPath) {
    try {
      const thumbnailFile = new File([thumbnail.blob], `${id}.${thumbnail.extension}`, { type: thumbnail.contentType });
      const { error } = await client.storage.from(MEMORY_IMAGE_BUCKET).upload(pending.thumbnailPath, thumbnailFile, {
        contentType: thumbnail.contentType,
        upsert: false,
      });
      if (error) throw error;
    } catch {
      // The derivative is optional. If upload outcome is uncertain, try to
      // discard the exact path, but never fail the original-memory post.
      try { await client.storage.from(MEMORY_IMAGE_BUCKET).remove([pending.thumbnailPath]); } catch { /* Best effort. */ }
      savedThumbnailPath = null;
    }
  }

  onStage?.("insert");
  let failure: unknown;
  let definitelyRejected = false;
  try {
    // The database default auth.uid() supplies user_id. No ownership field,
    // public URL, data URL or signed URL is sent by the client.
    const { error, status } = await client.from("memories").insert({
      id,
      image_path: pending.imagePath,
      thumbnail_path: savedThumbnailPath,
      ...fields,
    });
    if (!error) return savedMemory();
    failure = error;
    definitelyRejected = status >= 400 && status < 500 && Boolean(error.code);
  } catch (error) {
    failure = error;
  }

  onStage?.("cleanup");
  if (!definitelyRejected) {
    // Do not delete a successfully committed photo just because its INSERT
    // response was lost. Check the fixed UUID before compensating.
    const result = await recoverMemorySave(client, pending, false);
    if (result.saved) return savedMemory();
  } else {
    await removeUploadedImages(client, pending, `思い出を保存できませんでした。${errorDetail(failure)}`);
  }
  throw new MemorySaveError(`思い出を保存できませんでした。画像は取り消しました。${errorDetail(failure)}`);
}

type MemoryRow = {
  id: string; image_path: string; caption: string; memory_date: string; people: string[]; tags: string[];
  thumbnail_path?: string | null;
  letter?: string;
  album_appearance?: unknown;
  created_at?: string; updated_at?: string;
};

const MEMORY_ROW_COLUMN_SETS = [
  "id, image_path, thumbnail_path, caption, memory_date, people, tags, letter, album_appearance, created_at, updated_at",
  "id, image_path, thumbnail_path, caption, memory_date, people, tags, letter, created_at, updated_at",
  "id, image_path, thumbnail_path, caption, memory_date, people, tags, album_appearance, created_at, updated_at",
  "id, image_path, thumbnail_path, caption, memory_date, people, tags, created_at, updated_at",
  "id, image_path, caption, memory_date, people, tags, letter, album_appearance, created_at, updated_at",
  "id, image_path, caption, memory_date, people, tags, letter, created_at, updated_at",
  "id, image_path, caption, memory_date, people, tags, album_appearance, created_at, updated_at",
  "id, image_path, caption, memory_date, people, tags, created_at, updated_at",
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingOptionalMemoryColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const description = `${String(record.message ?? "")} ${String(record.details ?? "")}`.toLowerCase();
  return (description.includes("thumbnail_path") || description.includes("letter") || description.includes("album_appearance")) && (
    record.code === "42703"
    || record.code === "PGRST204"
    || description.includes("does not exist")
    || description.includes("could not find")
  );
}

function toMemory(row: MemoryRow, urls: { imageUrl?: string; thumbnailUrl?: string } = {}): Memory {
  return {
    id: row.id,
    imagePath: row.image_path,
    imageUrl: urls.imageUrl ?? "",
    thumbnailPath: row.thumbnail_path ?? undefined,
    thumbnailUrl: urls.thumbnailUrl,
    caption: row.caption, date: row.memory_date, people: row.people, tags: row.tags, letter: row.letter ?? "",
    albumAppearance: isAlbumAppearance(row.album_appearance) ? row.album_appearance : null,
    createdAt: row.created_at,
  };
}

async function signMemoryImage(client: SupabaseClient, imagePath: string) {
  try {
    const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
      .createSignedUrls([imagePath], MEMORY_IMAGE_URL_LIFETIME);
    if (error) throw error;
    const imageUrl = data?.[0]?.signedUrl ?? "";
    if (!imageUrl || data?.[0]?.error) throw data?.[0]?.error ?? new Error("Signed URL missing");
    return { imageUrl, warning: null };
  } catch {
    return { imageUrl: "", warning: "写真を読み込めませんでした。時間をおいて再読み込みしてください。" };
  }
}

async function loadOwnedMemoryRow(client: SupabaseClient, userId: string, id: string) {
  for (const columns of MEMORY_ROW_COLUMN_SETS) {
    const result = await client.from("memories").select(columns)
      .eq("user_id", userId).eq("id", id).maybeSingle();
    if (!result.error) return result.data as unknown as MemoryRow | null;
    if (!isMissingOptionalMemoryColumnError(result.error)) {
      throw new Error(`思い出を読み込めませんでした。${errorDetail(result.error)}`);
    }
  }
  throw new Error("思い出を読み込めませんでした。データベースの列を確認してください。");
}

async function loadMemoryOrder(client: SupabaseClient, userId: string) {
  const rows: Pick<MemoryRow, "id" | "memory_date" | "created_at">[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("memories").select("id, memory_date, created_at")
      .eq("user_id", userId).order("memory_date", { ascending: true })
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`前後の思い出を読み込めませんでした。${errorDetail(error)}`);
    const page = data as Pick<MemoryRow, "id" | "memory_date" | "created_at">[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.sort((a, b) => a.memory_date.localeCompare(b.memory_date)
    || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
}

export type MemoryDetail = {
  memory: Memory;
  previousId: string | null;
  nextId: string | null;
  warning: string | null;
};

export type LoadedMemory = Pick<MemoryDetail, "memory" | "warning">;

/** Load one memory for a list/cache without signing its original when a thumbnail exists. */
export async function loadMemoryPreview(client: SupabaseClient, id: string): Promise<LoadedMemory | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const user = await requireUser(client);
  const row = await loadOwnedMemoryRow(client, user.id, id);
  if (!row) return null;
  const displayPath = row.thumbnail_path ?? row.image_path;
  const signedImage = await signMemoryImage(client, displayPath);
  return {
    memory: row.thumbnail_path
      ? toMemory(row, { thumbnailUrl: signedImage.imageUrl || undefined })
      : toMemory(row, { imageUrl: signedImage.imageUrl }),
    warning: signedImage.warning,
  };
}

/** Load one memory without also reading the complete ordering. */
export async function loadMemory(client: SupabaseClient, id: string): Promise<LoadedMemory | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const user = await requireUser(client);
  const row = await loadOwnedMemoryRow(client, user.id, id);
  if (!row) return null;
  const signedImage = await signMemoryImage(client, row.image_path);
  return { memory: toMemory(row, { imageUrl: signedImage.imageUrl }), warning: signedImage.warning };
}

/** Load one owned row by URL id. RLS is authoritative; user_id is extra scoping. */
export async function loadMemoryDetail(client: SupabaseClient, id: string): Promise<MemoryDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const user = await requireUser(client);
  const row = await loadOwnedMemoryRow(client, user.id, id);
  if (!row) return null;

  const [order, signedImage] = await Promise.all([
    loadMemoryOrder(client, user.id),
    signMemoryImage(client, row.image_path),
  ]);
  const currentIndex = order.findIndex((item) => item.id === row.id);
  if (currentIndex < 0) throw new Error("前後の思い出を確認できませんでした。再読み込みしてください。");

  return {
    memory: toMemory(row, { imageUrl: signedImage.imageUrl }),
    previousId: currentIndex > 0 ? order[currentIndex - 1].id : null,
    nextId: currentIndex < order.length - 1 ? order[currentIndex + 1].id : null,
    warning: signedImage.warning,
  };
}

export class MemoryNotFoundError extends Error {
  constructor() {
    super("思い出が見つかりません。削除されたか、閲覧する権限がありません。");
    this.name = "MemoryNotFoundError";
  }
}

export async function updateMemory(client: SupabaseClient, id: string, input: MemoryUpdateInput) {
  if (!UUID_PATTERN.test(id)) throw new MemoryNotFoundError();
  const fields = validateMemoryFields(input);
  const user = await requireUser(client);
  let payload: Record<string, unknown> = fields;
  let lastError: unknown = null;
  for (const columns of MEMORY_ROW_COLUMN_SETS) {
    const result = await client.from("memories").update(payload)
      .eq("user_id", user.id).eq("id", id).select(columns).maybeSingle();
    if (!result.error) {
      if (!result.data) throw new MemoryNotFoundError();
      return toMemory(result.data as unknown as MemoryRow);
    }
    lastError = result.error;
    if (!isMissingOptionalMemoryColumnError(result.error)) break;
    const description = errorDetail(result.error).toLowerCase();
    if (description.includes("letter")) {
      if (fields.letter) {
        throw new Error("手紙を保存するためのデータベース更新がまだ完了していません。管理者がマイグレーションを適用した後に、もう一度お試しください。");
      }
      payload = {
        caption: fields.caption,
        memory_date: fields.memory_date,
        people: fields.people,
        tags: fields.tags,
      };
    }
  }
  throw new Error(`思い出を更新できませんでした。${errorDetail(lastError)}`);
}

export async function updateMemoryAlbumAppearance(client: SupabaseClient, id: string, appearance: AlbumAppearance) {
  if (!UUID_PATTERN.test(id)) throw new MemoryNotFoundError();
  if (!isAlbumAppearance(appearance)) throw new Error("アルバムの見た目設定が正しくありません。");
  const user = await requireUser(client);
  const { data, error } = await client.from("memories").update({ album_appearance: appearance })
    .eq("user_id", user.id).eq("id", id).select("id, album_appearance").maybeSingle();
  if (error) {
    if (isMissingOptionalMemoryColumnError(error) && errorDetail(error).toLowerCase().includes("album_appearance")) {
      throw new Error("個別の見た目を保存するためのデータベース更新がまだ完了していません。マイグレーションを適用してから、もう一度お試しください。");
    }
    throw new Error(`アルバムの見た目を保存できませんでした。${errorDetail(error)}`);
  }
  if (!data) throw new MemoryNotFoundError();
  const saved = (data as { album_appearance?: unknown }).album_appearance;
  if (!isAlbumAppearance(saved)) throw new Error("保存したアルバム設定を確認できませんでした。");
  return saved;
}

function isOwnedImagePath(imagePath: string, userId: string) {
  const parts = imagePath.split("/");
  return parts.length >= 2 && parts[0] === userId && parts.slice(1).every((part) => part && part !== "." && part !== "..");
}

async function restoreDeletedMemory(client: SupabaseClient, row: MemoryRow) {
  const { error } = await client.from("memories").insert({
    id: row.id,
    image_path: row.image_path,
    ...(row.thumbnail_path !== undefined ? { thumbnail_path: row.thumbnail_path } : {}),
    caption: row.caption,
    memory_date: row.memory_date,
    people: row.people,
    tags: row.tags,
    ...(row.letter !== undefined ? { letter: row.letter } : {}),
    ...(isAlbumAppearance(row.album_appearance) ? { album_appearance: row.album_appearance } : {}),
    ...(row.created_at ? { created_at: row.created_at } : {}),
    ...(row.updated_at ? { updated_at: row.updated_at } : {}),
  });
  return error;
}

async function storageObjectExists(client: SupabaseClient, imagePath: string) {
  const parts = imagePath.split("/");
  const fileName = parts.pop();
  if (!fileName) throw new Error("Invalid image path");
  const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
    .list(parts.join("/"), { limit: 100, search: fileName });
  if (error) throw error;
  return (data ?? []).some((item) => item.name === fileName);
}

/**
 * Delete the DB row first, then its private object. If Storage rejects the
 * removal, restore the captured row so the image does not become an orphan.
 * DB and Storage are separate services, so a double failure is reported for
 * manual cleanup instead of being presented as a successful deletion.
 */
export async function deleteMemory(client: SupabaseClient, id: string) {
  if (!UUID_PATTERN.test(id)) throw new MemoryNotFoundError();
  const user = await requireUser(client);
  const row = await loadOwnedMemoryRow(client, user.id, id);
  if (!row) throw new MemoryNotFoundError();
  if (!isOwnedImagePath(row.image_path, user.id)) {
    throw new Error("写真の保存先を安全に確認できないため、削除を中止しました。");
  }
  if (row.thumbnail_path && (!isOwnedImagePath(row.thumbnail_path, user.id)
    || row.thumbnail_path.split("/")[1] !== "thumbnails")) {
    throw new Error("サムネイルの保存先を安全に確認できないため、削除を中止しました。");
  }

  let deletionConfirmed = false;
  let deletionFailure: unknown = null;
  try {
    const { data, error } = await client.from("memories").delete()
      .eq("user_id", user.id).eq("id", id).select("id");
    deletionFailure = error;
    deletionConfirmed = !error && Array.isArray(data) && data.length === 1;
    if (!deletionConfirmed && !error) deletionFailure = new Error("削除対象を確認できませんでした。");
  } catch (error) {
    deletionFailure = error;
  }
  if (!deletionConfirmed) {
    let remaining: MemoryRow | null;
    try {
      remaining = await loadOwnedMemoryRow(client, user.id, id);
    } catch (verificationError) {
      throw new Error(
        `削除結果を確認できませんでした。写真は安全のため削除していません。` +
        `${errorDetail(deletionFailure)} / 確認: ${errorDetail(verificationError)}`,
      );
    }
    if (remaining) {
      throw new Error(`思い出を削除できませんでした。写真は削除していません。${errorDetail(deletionFailure)}`);
    }
    // The response may have been lost after commit. The missing owned row is
    // the evidence needed to continue cleaning up its captured image path.
  }

  let storageError: unknown = null;
  const imagePaths = row.thumbnail_path ? [row.image_path, row.thumbnail_path] : [row.image_path];
  try {
    const result = await client.storage.from(MEMORY_IMAGE_BUCKET).remove(imagePaths);
    storageError = result.error;
  } catch (error) {
    storageError = error;
  }
  if (!storageError) return { id };

  try {
    const remainingObjects = await Promise.all(imagePaths.map((path) => storageObjectExists(client, path)));
    if (remainingObjects.every((exists) => !exists)) {
      // The Storage response was lost after the object was removed.
      return { id };
    }
  } catch { /* If object state is uncertain, restore the DB row conservatively. */ }

  const restoreError = await restoreDeletedMemory(client, row);
  if (!restoreError) {
    throw new Error(`写真を削除できなかったため、思い出を元に戻しました。もう一度お試しください。${errorDetail(storageError)}`);
  }
  throw new Error(
    `思い出のレコードは削除されましたが、写真の削除とレコードの復元に失敗しました。` +
    `管理者による確認が必要です。写真削除: ${errorDetail(storageError)} / 復元: ${errorDetail(restoreError)}`,
  );
}

/** RLS remains authoritative; the owner filter is additional query scoping. */
export async function loadMemories(client: SupabaseClient): Promise<{ memories: Memory[]; warning: string | null; userId: string }> {
  const user = await requireUser(client);
  const rows: MemoryRow[] = [];
  const pageSize = 100;
  let offset = 0;
  let columnSetIndex = 0;
  for (;;) {
    const { data, error } = await client.from("memories")
      .select(MEMORY_ROW_COLUMN_SETS[columnSetIndex])
      .eq("user_id", user.id).order("memory_date", { ascending: false })
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error && columnSetIndex < MEMORY_ROW_COLUMN_SETS.length - 1 && isMissingOptionalMemoryColumnError(error)) {
      columnSetIndex += 1;
      continue;
    }
    if (error) throw new Error(`思い出を読み込めませんでした。${errorDetail(error)}`);
    const page = data as unknown as MemoryRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  const displayPaths = rows.map((row) => row.thumbnail_path ?? row.image_path);
  const urls = new Map<string, string>();
  let warning: string | null = null;
  // Sign only the lightweight derivative when present. Older rows without a
  // thumbnail keep using their original as a backward-compatible fallback.
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    try {
      const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
        .createSignedUrls(displayPaths.slice(offset, offset + pageSize), MEMORY_IMAGE_URL_LIFETIME);
      if (error) throw error;
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
      }
    } catch {
      // An image-read failure must not make saved database rows disappear.
      warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
    }
  }
  if (displayPaths.some((path) => !urls.has(path))) {
    warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
  }
  return {
    memories: rows.map((row) => row.thumbnail_path
      ? toMemory(row, { thumbnailUrl: urls.get(row.thumbnail_path) })
      : toMemory(row, { imageUrl: urls.get(row.image_path) ?? "" })),
    warning,
    userId: user.id,
  };
}

/** Sign original images only for an explicit high-quality action such as print. */
export async function loadMemoryOriginalUrls(client: SupabaseClient, memories: Memory[]) {
  const user = await requireUser(client);
  const owned = memories.filter((memory): memory is Memory & { imagePath: string } => (
    Boolean(memory.imagePath) && isOwnedImagePath(memory.imagePath!, user.id)
  ));
  if (owned.length !== memories.length) throw new Error("印刷する写真の保存先を安全に確認できませんでした。");

  const urls = new Map<string, string>();
  const pageSize = 100;
  for (let offset = 0; offset < owned.length; offset += pageSize) {
    const page = owned.slice(offset, offset + pageSize);
    const memoryByPath = new Map(page.map((memory) => [memory.imagePath, memory]));
    const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
      .createSignedUrls(page.map((memory) => memory.imagePath), MEMORY_IMAGE_URL_LIFETIME);
    if (error) throw new Error(`印刷用の元画像を読み込めませんでした。${errorDetail(error)}`);
    for (const item of data ?? []) {
      const memory = item.path ? memoryByPath.get(item.path) : undefined;
      if (memory && item.signedUrl && !item.error) urls.set(memory.id, item.signedUrl);
    }
  }
  if (urls.size !== memories.length) throw new Error("印刷用の元画像をすべて読み込めませんでした。");
  return urls;
}
