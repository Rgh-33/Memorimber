import type { SupabaseClient } from "@supabase/supabase-js";
import { isAlbumAppearance, type AlbumAppearance } from "../album-appearance.ts";

type AlbumPreferenceRow = {
  album_appearance_default?: unknown;
};

function errorDetail(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "通信状態を確認して、もう一度お試しください。";
}

function isMissingAlbumPreferenceColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const description = `${String(record.message ?? "")} ${String(record.details ?? "")}`.toLowerCase();
  return description.includes("album_appearance_default") && (
    record.code === "42703"
    || record.code === "PGRST204"
    || description.includes("does not exist")
    || description.includes("could not find")
  );
}

function migrationRequiredError() {
  return new Error("アルバム設定を保存するためのデータベース更新がまだ完了していません。マイグレーションを適用してから、もう一度お試しください。");
}

async function requireUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("ログインを確認できませんでした。再度ログインしてからお試しください。");
  }
  return data.user;
}

/** RLS is authoritative; the id filter is an additional ownership boundary. */
export async function loadAccountAlbumAppearance(client: SupabaseClient): Promise<AlbumAppearance | null> {
  const user = await requireUser(client);
  const { data, error } = await client.from("profiles")
    .select("album_appearance_default")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingAlbumPreferenceColumnError(error)) throw migrationRequiredError();
    throw new Error(`アルバム設定を読み込めませんでした。${errorDetail(error)}`);
  }
  if (!data) throw new Error("プロフィールを確認できませんでした。再度ログインしてからお試しください。");

  const value = (data as AlbumPreferenceRow).album_appearance_default;
  if (value === null) return null;
  if (!isAlbumAppearance(value)) throw new Error("保存されているアルバム設定が正しくありません。");
  return value;
}

export async function updateAccountAlbumAppearance(client: SupabaseClient, appearance: AlbumAppearance) {
  if (!isAlbumAppearance(appearance)) throw new Error("アルバムの見た目設定が正しくありません。");
  const user = await requireUser(client);
  const { data, error } = await client.from("profiles")
    .update({ album_appearance_default: appearance })
    .eq("id", user.id)
    .select("album_appearance_default")
    .maybeSingle();

  if (error) {
    if (isMissingAlbumPreferenceColumnError(error)) throw migrationRequiredError();
    throw new Error(`アルバム設定を保存できませんでした。${errorDetail(error)}`);
  }
  if (!data) throw new Error("プロフィールを確認できませんでした。再度ログインしてからお試しください。");

  const saved = (data as AlbumPreferenceRow).album_appearance_default;
  if (!isAlbumAppearance(saved)) throw new Error("保存したアルバム設定を確認できませんでした。");
  return saved;
}
