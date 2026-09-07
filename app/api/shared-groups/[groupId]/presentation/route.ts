import { after } from "next/server";
import { retryAuthenticatedCleanup } from "@/lib/supabase/authenticated-cleanup";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/supabase/shared-albums";
export async function GET(_request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isUuid(groupId)) return Response.json({ error: "Not found" }, { status: 404 });
  const client = await createClient();
  const { data, error } = await client.from("shared_albums").select("icon_path,show_caption,show_date,quiz_mode,balance_quiz_contributors,quiz_month_count,quiz_photo_to_caption_count,quiz_caption_to_photo_count,quiz_seconds_per_question").eq("id", groupId).maybeSingle();
  if (error) return Response.json({ error: "設定を読み込めませんでした。" }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  let iconDataUrl: string | null = null;
  if (data.icon_path) {
    const signed = await client.storage.from("shared-group-icons").createSignedUrl(data.icon_path, 3600);
    if (signed.error) return Response.json({ error: "グループ画像を読み込めませんでした。" }, { status: 500 });
    iconDataUrl = signed.data?.signedUrl ?? null;
  }
  return Response.json({ iconDataUrl, iconExpiresAt: Date.now() + 3600000, showCaption: data.show_caption, showDate: data.show_date,
    quizMode: data.quiz_mode, balanceQuizContributors: data.balance_quiz_contributors, quizMonthCount: data.quiz_month_count,
    quizPhotoToCaptionCount: data.quiz_photo_to_caption_count, quizCaptionToPhotoCount: data.quiz_caption_to_photo_count, quizSecondsPerQuestion: data.quiz_seconds_per_question,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isUuid(groupId)) return Response.json({ error: "Not found" }, { status: 404 });
  const client = await createClient();
  const patch = await request.json().catch(() => null);
  const { error } = await client.rpc("update_group_presentation", { p_group: groupId, p_patch: patch });
  if (error) return Response.json({ error: "設定を保存できませんでした。設定値と権限を確認してください。" }, { status: 400 });
  return Response.json({ ok: true });
}
export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isUuid(groupId)) return Response.json({ error: "Not found" }, { status: 404 });
  const client = await createClient();
  const form = await request.formData();
  const file = form.get("icon");
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return Response.json({ error: "グループ画像は5MB以下のJPEG・PNG・WebPを選んでください。" }, { status: 400 });
  try {
    const { data: path, error: reserveError } = await client.rpc("reserve_group_icon", { p_group: groupId });
    if (reserveError || typeof path !== "string") throw reserveError;
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, { limitInputPixels: 40000000 }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Invalid image");
    const bytes = await sharp(input, { limitInputPixels: 40000000 }).rotate().resize(256, 256, { fit: "cover", position: "centre" }).webp().toBuffer();
    const upload = await client.storage.from("shared-group-icons").upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (upload.error) throw upload.error;
    const commit = await client.rpc("commit_group_icon", { p_group: groupId, p_path: path });
    if (commit.error) throw commit.error;
    after(() => retryAuthenticatedCleanup(client));
    return Response.json({ ok: true });
  } catch {
    after(() => retryAuthenticatedCleanup(client));
    return Response.json({ error: "グループ画像を反映できませんでした。" }, { status: 400 });
  }
}
