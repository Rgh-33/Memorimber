import type { SupabaseClient } from "@supabase/supabase-js";
import type { Memory, MemoryInput } from "../types";

export const MEMORY_IMAGE_BUCKET = "memory-images";
export const MAX_MEMORY_IMAGE_BYTES = 20 * 1024 * 1024;
export const MEMORY_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
export const MEMORY_IMAGE_URL_LIFETIME = 60 * 60;

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

export function validateMemoryInput(input: MemoryInput) {
  const imageType = getMemoryImageType(input.image);
  const caption = input.caption.trim();
  if (!caption || [...caption].length > 80) throw new Error("一言は1〜80文字で入力してください。");
  const parsedDate = new Date(`${input.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== input.date) {
    throw new Error("日付を正しく入力してください。");
  }
  const strings = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return {
    ...imageType,
    fields: { caption, memory_date: input.date, people: strings(input.people), tags: strings(input.tags) },
  };
}

export type PendingMemoryUpload = { id: string; userId: string; imagePath: string };
export type MemorySaveStage = "auth" | "upload" | "insert" | "cleanup";
export const PENDING_MEMORY_STORAGE_KEY = "memorimber-pending-memory-upload";

export function readPendingMemoryUpload(storage: Pick<Storage, "getItem">): PendingMemoryUpload | null {
  try {
    const pending = JSON.parse(storage.getItem(PENDING_MEMORY_STORAGE_KEY) ?? "null");
    if (pending && typeof pending.userId === "string" && typeof pending.id === "string"
      && /^[0-9a-f-]{36}$/i.test(pending.id) && /^[0-9a-f-]{36}$/i.test(pending.userId)
      && typeof pending.imagePath === "string"
      && new RegExp(`^${pending.userId}/${pending.id}\\.(jpg|png|webp|heic|heif)$`).test(pending.imagePath)) {
      return { id: pending.id, userId: pending.userId, imagePath: pending.imagePath };
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

async function removeUploadedImage(client: SupabaseClient, pending: PendingMemoryUpload, reason: string) {
  try {
    const { error } = await client.storage.from(MEMORY_IMAGE_BUCKET).remove([pending.imagePath]);
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
  if (user.id !== pending.userId || !pending.imagePath.startsWith(`${user.id}/${pending.id}.`)
    || pending.imagePath.split("/").length !== 2) {
    throw new MemorySaveError("投稿したアカウントでログインし直してから、保存状態を確認してください。", pending);
  }
  try {
    const { data, error } = await client.from("memories").select("id, image_path")
      .eq("user_id", user.id).eq("id", pending.id).maybeSingle();
    if (error) throw error;
    if (data) {
      if (data.image_path !== pending.imagePath) throw new Error("画像の保存先が一致しません。");
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
  await removeUploadedImage(client, pending, "思い出は保存されていません。");
  return { saved: false as const, id: pending.id };
}

export async function saveMemory(
  client: SupabaseClient,
  input: MemoryInput,
  onStage?: (stage: MemorySaveStage) => void,
  onPending?: (pending: PendingMemoryUpload) => void,
) {
  const { fields, contentType, extension } = validateMemoryInput(input);
  onStage?.("auth");
  const user = await requireUser(client);
  const id = createMemoryId();
  const pending = { id, userId: user.id, imagePath: `${user.id}/${id}.${extension}` };
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

  onStage?.("insert");
  let failure: unknown;
  let definitelyRejected = false;
  try {
    // The database default auth.uid() supplies user_id. No ownership field,
    // public URL, data URL or signed URL is sent by the client.
    const { error, status } = await client.from("memories").insert({ id, image_path: pending.imagePath, ...fields });
    if (!error) return { id };
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
    if (result.saved) return { id };
  } else {
    await removeUploadedImage(client, pending, `思い出を保存できませんでした。${errorDetail(failure)}`);
  }
  throw new MemorySaveError(`思い出を保存できませんでした。画像は取り消しました。${errorDetail(failure)}`);
}

type MemoryRow = {
  id: string; image_path: string; caption: string; memory_date: string; created_at?: string; people: string[]; tags: string[];
};

/** RLS remains authoritative; the owner filter is additional query scoping. */
export async function loadMemories(client: SupabaseClient): Promise<{ memories: Memory[]; warning: string | null; userId: string }> {
  const user = await requireUser(client);
  const rows: MemoryRow[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("memories")
      .select("id, image_path, caption, memory_date, created_at, people, tags")
      .eq("user_id", user.id).order("memory_date", { ascending: false })
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`思い出を読み込めませんでした。${errorDetail(error)}`);
    const page = data as MemoryRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const urls = new Map<string, string>();
  let warning: string | null = null;
  // Private originals are displayed via short-lived signed URLs, never getPublicUrl.
  for (let offset = 0; offset < rows.length; offset += pageSize) {
    try {
      const { data, error } = await client.storage.from(MEMORY_IMAGE_BUCKET)
        .createSignedUrls(rows.slice(offset, offset + pageSize).map((row) => row.image_path), MEMORY_IMAGE_URL_LIFETIME);
      if (error) throw error;
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
      }
    } catch {
      // An image-read failure must not make saved database rows disappear.
      warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
    }
  }
  if (urls.size !== rows.length) warning = "一部の写真を読み込めませんでした。時間をおいて再読み込みしてください。";
  return {
    userId: user.id,
    memories: rows.map((row) => ({
      id: row.id, imagePath: row.image_path, imageUrl: urls.get(row.image_path) ?? "",
      caption: row.caption, date: row.memory_date, createdAt: row.created_at, people: row.people, tags: row.tags,
    })),
    warning,
  };
}
