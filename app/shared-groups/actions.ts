"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { processRetainedMemoryCleanupQueue } from "@/lib/supabase/account-deletion-runner";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { inviteToSharedAlbum, respondToSharedAlbumInvitation } from "@/lib/supabase/shared-album-invitations";
import {
  addMemoryToSharedAlbum,
  createSharedAlbum,
  deleteSharedAlbum,
  isUuid,
  leaveSharedAlbum,
  removeMemoryFromSharedAlbum,
  removeSharedAlbumMember,
} from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";

function noticePath(path: string, tone: "success" | "error", message: string) {
  return `${path}?${new URLSearchParams({ [tone]: message })}`;
}

function groupPath(groupId: unknown) {
  if (!isUuid(groupId)) throw new Error("グループが正しくありません。");
  return `/shared-groups/${groupId}`;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function authenticatedClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabaseの接続情報が設定されていません。");
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("ログイン状態を確認できませんでした。");
  return client;
}

function revalidateGroup(groupId: string) {
  revalidatePath("/shared-groups");
  revalidatePath(`/shared-groups/${groupId}`);
  revalidatePath("/notifications");
}

async function cleanupUnsharedRetainedMemories() {
  try {
    await processRetainedMemoryCleanupQueue(createAdminClient());
  } catch {
    // The durable queue is retried by the daily cron when immediate cleanup fails.
  }
}

export async function createSharedGroupAction(formData: FormData) {
  let albumId: string | null = null;
  let failure: string | null = null;
  try {
    const album = await createSharedAlbum(await authenticatedClient(), formData.get("name"));
    albumId = album.id;
  } catch (error) {
    failure = errorText(error, "グループを作成できませんでした。");
  }
  if (failure || !albumId) redirect(noticePath("/shared-groups", "error", failure ?? "グループを作成できませんでした。"));
  revalidateGroup(albumId);
  redirect(noticePath(`/shared-groups/${albumId}`, "success", "グループを作成しました。"));
}

export async function respondInvitationAction(formData: FormData) {
  const invitationId = formData.get("invitationId");
  const response = formData.get("response");
  let result: { albumId: string; status: string } | null = null;
  let failure: string | null = null;
  try {
    if (typeof invitationId !== "string" || (response !== "accepted" && response !== "declined")) {
      throw new Error("招待への回答が正しくありません。");
    }
    result = await respondToSharedAlbumInvitation(await authenticatedClient(), invitationId, response);
  } catch (error) {
    failure = errorText(error, "招待へ回答できませんでした。");
  }
  if (failure || !result) redirect(noticePath("/shared-groups", "error", failure ?? "招待へ回答できませんでした。"));
  revalidateGroup(result.albumId);
  if (result.status === "accepted") {
    redirect(noticePath(`/shared-groups/${result.albumId}`, "success", "招待を承認しました。"));
  }
  const message = result.status === "expired" ? "招待の有効期限が切れています。" : "招待を辞退しました。";
  redirect(noticePath("/shared-groups", "success", message));
}

export async function inviteSharedGroupMemberAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await inviteToSharedAlbum(await authenticatedClient(), String(groupId), formData.get("email"));
  } catch (error) {
    failure = errorText(error, "招待を送信できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", "招待を送信しました。"));
}

export async function addSharedMemoryAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await addMemoryToSharedAlbum(await authenticatedClient(), String(groupId), String(formData.get("memoryId") ?? ""));
  } catch (error) {
    failure = errorText(error, "思い出を共有できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", "思い出を共有しました。"));
}

export async function removeSharedMemoryAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await removeMemoryFromSharedAlbum(await authenticatedClient(), String(groupId), String(formData.get("memoryId") ?? ""));
    await cleanupUnsharedRetainedMemories();
  } catch (error) {
    failure = errorText(error, "思い出の共有を解除できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", "共有を解除しました。"));
}

export async function leaveSharedGroupAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await leaveSharedAlbum(await authenticatedClient(), String(groupId), formData.get("memoryHandling") === "remove");
    await cleanupUnsharedRetainedMemories();
  } catch (error) {
    failure = errorText(error, "グループから退出できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath("/shared-groups", "success", "グループから退出しました。"));
}

export async function removeSharedGroupMemberAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await removeSharedAlbumMember(await authenticatedClient(), String(groupId), String(formData.get("userId") ?? ""));
    await cleanupUnsharedRetainedMemories();
  } catch (error) {
    failure = errorText(error, "メンバーを除外できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", "メンバーを除外し、その人の共有を解除しました。"));
}

export async function deleteSharedGroupAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    if (formData.get("confirm") !== "delete") throw new Error("削除の確認にチェックを入れてください。");
    await deleteSharedAlbum(await authenticatedClient(), String(groupId));
    await cleanupUnsharedRetainedMemories();
  } catch (error) {
    failure = errorText(error, "グループを削除できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath("/shared-groups", "success", "グループを削除しました。現在のメンバーが所有する元の思い出と写真は残っています。"));
}
