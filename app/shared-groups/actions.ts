"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { retryAuthenticatedCleanup } from "@/lib/supabase/authenticated-cleanup";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { inviteToSharedAlbum, respondToSharedAlbumInvitation } from "@/lib/supabase/shared-album-invitations";
import {
  addMemoriesToSharedAlbum,
  createSharedAlbum,
  deleteSharedAlbum,
  isUuid,
  leaveSharedAlbum,
  renameSharedAlbum,
  removeMemoryFromSharedAlbum,
  removeSharedAlbumMember,
} from "@/lib/supabase/shared-albums";
import { joinSharedQuiz, startSharedQuiz } from "@/lib/supabase/shared-quiz";
import { createClient } from "@/lib/supabase/server";

function noticePath(
  path: string,
  tone: "success" | "error",
  message: string,
  extra: Record<string, string> = {},
) {
  return `${path}?${new URLSearchParams({ [tone]: message, ...extra })}`;
}

function groupPath(groupId: unknown) {
  if (!isUuid(groupId)) throw new Error("グループが正しくありません。");
  return `/shared-groups/${groupId}`;
}

function quizPath(groupId: unknown, sessionId: unknown) {
  const path = groupPath(groupId);
  if (!isUuid(sessionId)) throw new Error("クイズが正しくありません。");
  return `${path}/quiz/${sessionId}`;
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

export async function renameSharedGroupAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    await renameSharedAlbum(await authenticatedClient(), String(groupId), formData.get("name"));
  } catch (error) {
    failure = errorText(error, "グループ名を変更できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", "グループ名を変更しました。"));
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
    const cause = error instanceof Error && error.cause && typeof error.cause === "object"
      ? error.cause as Record<string, unknown>
      : null;
    console.error("[shared-groups] Invitation response failed", {
      rpc: "respond_to_shared_album_invitation",
      code: typeof cause?.code === "string" ? cause.code : null,
      message: typeof cause?.message === "string" ? cause.message : failure,
    });
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
  let count = 0;
  try {
    path = groupPath(groupId);
    count = await addMemoriesToSharedAlbum(await authenticatedClient(), String(groupId), formData.getAll("memoryId"));
  } catch (error) {
    failure = errorText(error, "思い出を共有できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath(path, "success", `思い出を${count}件共有しました。`, {
    activity: "shared-memory",
    activityId: `${String(groupId)}:${Date.now()}`,
    activityCount: String(count),
  }));
}

export async function joinSharedQuizAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let sessionId: string | null = null;
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    const session = await joinSharedQuiz(await authenticatedClient(), String(groupId));
    sessionId = session.id;
  } catch (error) {
    failure = errorText(error, "クイズに参加できませんでした。");
  }
  if (failure || !sessionId) redirect(noticePath(path, "error", failure ?? "クイズに参加できませんでした。"));
  revalidateGroup(String(groupId));
  redirect(quizPath(groupId, sessionId));
}

export async function startSharedQuizAction(formData: FormData) {
  const groupId = formData.get("groupId");
  const sessionId = formData.get("sessionId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = quizPath(groupId, sessionId);
    const client = await authenticatedClient();
    await startSharedQuiz(client, String(sessionId));
  } catch (error) {
    failure = errorText(error, "クイズを開始できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidatePath(path);
  redirect(path);
}

export type RemoveSharedMemoryResult = { ok: false; error: string };

export async function removeSharedMemoryAction(
  _previousState: RemoveSharedMemoryResult | null,
  formData: FormData,
): Promise<RemoveSharedMemoryResult> {
  console.info("[shared-groups] Memory removal started");
  const groupId = formData.get("groupId");
  try {
    groupPath(groupId);
    const client = await authenticatedClient();
    await removeMemoryFromSharedAlbum(client, String(groupId), String(formData.get("memoryId") ?? ""));
    await retryAuthenticatedCleanup(client);
  } catch (error) {
    const message = errorText(error, "思い出の共有を解除できませんでした。");
    const cause = error instanceof Error && error.cause && typeof error.cause === "object"
      ? error.cause as Record<string, unknown>
      : null;
    console.error("[shared-groups] Memory removal failed", {
      code: typeof cause?.code === "string" ? cause.code : null,
      message: typeof cause?.message === "string" ? cause.message : message,
    });
    return { ok: false, error: message };
  }
  console.info("[shared-groups] Memory removal succeeded");
  revalidateGroup(String(groupId));
  redirect(noticePath(groupPath(groupId), "success", "共有を解除しました。"));
}

export async function leaveSharedGroupAction(formData: FormData) {
  const groupId = formData.get("groupId");
  let path = "/shared-groups";
  let failure: string | null = null;
  try {
    path = groupPath(groupId);
    const client = await authenticatedClient();
    await leaveSharedAlbum(client, String(groupId), formData.get("memoryHandling") === "remove");
    await retryAuthenticatedCleanup(client);
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
    const client = await authenticatedClient();
    await removeSharedAlbumMember(client, String(groupId), String(formData.get("userId") ?? ""));
    await retryAuthenticatedCleanup(client);
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
    const client = await authenticatedClient();
    await deleteSharedAlbum(client, String(groupId));
    await retryAuthenticatedCleanup(client);
  } catch (error) {
    failure = errorText(error, "グループを削除できませんでした。");
  }
  if (failure) redirect(noticePath(path, "error", failure));
  revalidateGroup(String(groupId));
  redirect(noticePath("/shared-groups", "success", "グループを削除しました。現在のメンバーが所有する元の思い出と写真は残っています。"));
}
