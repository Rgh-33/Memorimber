"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Gamepad2,
  Pencil,
  Settings,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import {
  addSharedMemoryAction,
  deleteSharedGroupAction,
  inviteSharedGroupMemberAction,
  leaveSharedGroupAction,
  renameSharedGroupAction,
  removeSharedGroupMemberAction,
} from "@/app/shared-groups/actions";
import { MemoryPhoto } from "@/components/memory-photo";
import { SharedAddButton } from "@/components/shared-add-button";
import { SharedGroupDialog } from "@/components/shared-group-dialog";
import { SharedGroupIcon } from "@/components/shared-group-icon";
import { SharedMemberAvatar, SharedMemberName } from "@/components/shared-member-identity";
import {
  SHARED_GROUP_ICON_ACCEPT,
  useSharedGroupPresentation,
  validateSharedGroupIcon,
} from "@/components/shared-group-presentation";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { formatShortDate } from "@/lib/data";
import {
  type SharedAlbumMember,
  type SharedMemoryChoice,
} from "@/lib/supabase/shared-albums";

const secondaryButton = "min-h-11 rounded-xl border border-line bg-ivory px-4 py-3 text-sm font-semibold transition hover:bg-paper focus-visible:outline-coral disabled:opacity-45";
const dangerButton = "min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10 focus-visible:outline-red-500";
const settingRow = "flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-3 text-left transition hover:border-coral/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";
const roundCheckbox = "mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-full border-2 border-ink/25 bg-ivory transition checked:border-[5px] checked:border-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral";

type SettingsPanel = { kind: "settings" | "display" | "quiz" | "invite" | "delete" | "leave" }
  | { kind: "remove"; member: SharedAlbumMember };

type SettingsProps = {
  groupId: string;
  name: string;
  userId: string;
  isOwner: boolean;
  members: SharedAlbumMember[];
};

export function SharedGroupControls({
  groupId,
  name,
  userId,
  isOwner,
  members,
}: SettingsProps) {
  const { presentation, updatePresentation, uploadIcon } = useSharedGroupPresentation(groupId);
  const [panel, setPanel] = useState<SettingsPanel | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [quizModeDraft, setQuizModeDraft] = useState<"random" | "custom">("random");
  const pendingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openSettings = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setNameEditing(false);
    setNameDraft(name);
    setSettingsError(null);
    setPanel({ kind: "settings" });
  };
  const close = () => {
    if (!pendingRef.current) {
      setNameEditing(false);
      setPanel(null);
    }
  };
  const showPanel = (next: SettingsPanel) => {
    if (pendingRef.current) return;
    setSettingsError(null);
    if (next.kind === "quiz") setQuizModeDraft(presentation.quizMode);
    setPanel(next);
  };
  const submitAction = (action: (formData: FormData) => Promise<void>) => async (formData: FormData) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    try {
      await action(formData);
    } finally {
      pendingRef.current = false;
      setBusy(false);
      setPanel(null);
    }
  };
  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current) return;
    const formData = new FormData(event.currentTarget);
    pendingRef.current = true;
    setBusy(true);
    setSettingsError(null);
    try {
      const intent = formData.get("intent");
      if (intent === "display") {
        await updatePresentation({
          showCaption: formData.get("showCaption") === "on",
          showDate: formData.get("showDate") === "on",
        });
      } else if (intent === "quiz") {
        const quizMode = formData.get("quizMode") === "custom" ? "custom" : "random";
        const quizMonthCount = quizMode === "custom" ? Number(formData.get("quizMonthCount")) : presentation.quizMonthCount;
        const quizPhotoToCaptionCount = quizMode === "custom" ? Number(formData.get("quizPhotoToCaptionCount")) : presentation.quizPhotoToCaptionCount;
        const quizCaptionToPhotoCount = quizMode === "custom" ? Number(formData.get("quizCaptionToPhotoCount")) : presentation.quizCaptionToPhotoCount;
        const quizSeconds = quizMode === "custom" ? Number(formData.get("quizSecondsPerQuestion")) : 5;
        if (
          quizMode === "custom"
          && quizMonthCount + quizPhotoToCaptionCount + quizCaptionToPhotoCount !== 10
        ) throw new Error("カスタムの問題数は合計10問にしてください。");
        await updatePresentation({
          quizMode,
          balanceQuizContributors: formData.get("balanceQuizContributors") === "on",
          quizMonthCount,
          quizPhotoToCaptionCount,
          quizCaptionToPhotoCount,
          quizSecondsPerQuestion: quizSeconds === 3 || quizSeconds === 10 ? quizSeconds : 5,
        });
      } else {
        throw new Error("変更する設定を選んでください。");
      }
      setPanel(null);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "表示設定を反映できませんでした。");
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  const selectIcon = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!validateSharedGroupIcon(file)) {
      setSettingsError("グループ画像は5MB以下のJPEG・PNG・WebPを選んでください。");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setSettingsError(null);
    try {
      await uploadIcon(file);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "グループ画像を反映できませんでした。");
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };

  const displaySummary = presentation.showCaption && presentation.showDate ? "一言・日付"
    : presentation.showCaption ? "一言"
      : presentation.showDate ? "日付" : "写真のみ";
  const quizSummary = presentation.quizMode === "random"
    ? `ランダム・5秒${presentation.balanceQuizContributors ? "・投稿者を平等化" : ""}`
    : `カスタム・${presentation.quizSecondsPerQuestion}秒${presentation.balanceQuizContributors ? "・投稿者を平等化" : ""}`;
  const title = panel?.kind === "invite" ? "メンバーを招待"
    : panel?.kind === "display" ? "写真の表示"
      : panel?.kind === "quiz" ? "みんなでクイズ"
      : panel?.kind === "remove" ? "メンバーを除外"
        : panel?.kind === "delete" ? "グループを削除"
          : panel?.kind === "leave" ? "グループから退出" : "グループ設定";

  return (
    <>
      <button
        type="button"
        onClick={(event) => openSettings(event.currentTarget)}
        aria-label="グループ設定"
        aria-haspopup="dialog"
        className="group grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-paper hover:text-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-ivory shadow-sm transition group-hover:border-coral/30" aria-hidden="true">
          <Settings size={17} />
        </span>
      </button>

      {panel ? (
        <SharedGroupDialog title={title} subtitle={panel.kind === "settings" ? undefined : name} busy={busy} fullScreen onClose={close} returnFocusRef={triggerRef}>
          {panel.kind === "settings" ? (
            <div className="mt-3 space-y-7 pb-2">
              <section className="px-1 text-center" aria-label="グループプロフィール">
                {isOwner ? (
                  <label className="group relative mx-auto block w-fit cursor-pointer" aria-label="グループ画像を変更">
                    <SharedGroupIcon groupId={groupId} size="profile" className="border-2 border-coral bg-paper shadow-card ring-4 ring-coral/10" />
                    <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-2 border-ivory bg-coral text-white shadow-sm" aria-hidden="true">
                      <Camera size={15} />
                    </span>
                    <input type="file" name="icon" accept={SHARED_GROUP_ICON_ACCEPT} disabled={busy} onChange={selectIcon} className="sr-only" />
                  </label>
                ) : (
                  <SharedGroupIcon groupId={groupId} size="profile" className="mx-auto border-2 border-coral bg-paper shadow-card ring-4 ring-coral/10" />
                )}

                <div className="mt-4">
                  {nameEditing && isOwner ? (
                    <form action={submitAction(renameSharedGroupAction)} className="relative flex min-h-[58px] items-center justify-center border-b border-coral/35 px-11">
                      <input type="hidden" name="groupId" value={groupId} />
                      <input
                        data-dialog-autofocus
                        type="text"
                        name="name"
                        value={nameDraft}
                        maxLength={60}
                        required
                        onChange={(event) => setNameDraft(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Escape") setNameEditing(false); }}
                        aria-label="グループ名を編集"
                        className="min-w-0 w-full bg-transparent py-2.5 text-center text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral outline-none"
                      />
                      <button type="submit" disabled={!nameDraft.trim() || busy} className="absolute right-0 grid h-9 w-9 place-items-center rounded-full bg-coral text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35" aria-label="グループ名を確定">
                        <Check size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <div className="relative flex min-h-[58px] items-center justify-center px-11">
                      <p className="min-w-0 max-w-full break-words py-1.5 text-[28px] font-semibold leading-[1.3] tracking-[0.04em] text-coral">{name}</p>
                      {isOwner ? (
                        <button type="button" onClick={() => { setNameDraft(name); setNameEditing(true); }} className="absolute right-0 grid h-9 w-9 place-items-center rounded-full text-coral transition hover:bg-coral/10" aria-label="グループ名を編集">
                          <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {settingsError ? <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-600">{settingsError}</p> : null}
              </section>

              <section className="border-t border-line pt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">メンバー</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-ink/50">{members.length}人</span>
                    {isOwner ? (
                      <button type="button" onClick={() => showPanel({ kind: "invite" })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-coral transition hover:bg-coral/10 focus-visible:outline-coral">
                        <UserRoundPlus size={16} aria-hidden="true" />招待
                      </button>
                    ) : null}
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {members.map((member) => (
                    <li key={member.userId} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2">
                      <Link
                        href={`/shared-groups/${groupId}/members/${member.userId}`}
                        className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
                        aria-label={`${member.displayName}のプロフィールを見る`}
                      >
                        <SharedMemberAvatar
                          displayName={member.displayName}
                          avatarUrl={member.avatarUrl}
                          isOwner={member.role === "owner"}
                          isCurrentUser={member.userId === userId}
                        />
                      </Link>
                      <div className="min-w-0 flex-1 basis-28">
                        <p className="break-words text-sm font-medium">
                          <SharedMemberName displayName={member.displayName} level={member.level} isCurrentUser={member.userId === userId} />
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink/55">{member.role === "owner" ? "オーナー" : "メンバー"}</p>
                      </div>
                      {isOwner && member.role === "member" ? <button type="button" onClick={() => showPanel({ kind: "remove", member })} className={`${dangerButton} border border-red-500/50`} aria-label={`${member.displayName}を除外`}>除外</button> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={`border-t border-line pt-5 ${isOwner ? "" : "opacity-60"}`}>
                <h3 className="mb-3 text-sm font-semibold">表示設定</h3>
                <button type="button" onClick={() => showPanel({ kind: "display" })} className={settingRow}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><Camera size={18} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">写真の表示</span>
                    <span className="mt-0.5 block text-[11px] text-ink/50">現在：{displaySummary}／一言・日付</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink/35" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => showPanel({ kind: "quiz" })} className={`${settingRow} mt-2`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><Gamepad2 size={18} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">みんなでクイズ</span>
                    <span className="mt-0.5 block text-[11px] text-ink/50">現在：{quizSummary}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink/35" aria-hidden="true" />
                </button>
              </section>

              <div className="border-t border-line pt-3 text-center">
                {isOwner ? <button type="button" onClick={() => showPanel({ kind: "delete" })} className={`${dangerButton} inline-flex items-center gap-2`}><Trash2 size={18} aria-hidden="true" />グループを削除</button>
                  : <button type="button" onClick={() => showPanel({ kind: "leave" })} className={dangerButton}>グループから退出</button>}
              </div>
            </div>
          ) : null}

          {panel.kind === "display" ? (
            <form onSubmit={saveSettings} className="mt-4">
              <input type="hidden" name="intent" value="display" />
              <p className="text-xs leading-6 text-ink/60">このタブ内で写真に添える情報を選べます。両方とも選ばない場合は、写真だけを3列で表示します。</p>
              <fieldset disabled={busy || !isOwner} className={`mt-4 space-y-2 ${isOwner ? "" : "opacity-55"}`}>
                <legend className="sr-only">写真に表示する情報</legend>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 transition hover:border-coral/35">
                  <input type="checkbox" name="showCaption" defaultChecked={presentation.showCaption} className={roundCheckbox} />
                  <span><strong className="block text-sm font-semibold">一言を表示</strong><span className="mt-0.5 block text-[11px] leading-5 text-ink/50">写真の下に思い出の一言を表示します。</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 transition hover:border-coral/35">
                  <input type="checkbox" name="showDate" defaultChecked={presentation.showDate} className={roundCheckbox} />
                  <span><strong className="block text-sm font-semibold">日付を表示</strong><span className="mt-0.5 block text-[11px] leading-5 text-ink/50">写真の下に思い出の日付を表示します。</span></span>
                </label>
              </fieldset>
              {settingsError ? <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-600">{settingsError}</p> : null}
              {isOwner ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>戻る</button>
                  <button type="submit" disabled={busy} className="accent-gradient min-h-11 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-45">{busy ? "反映中…" : "反映"}</button>
                </div>
              ) : (
                <button type="button" onClick={() => showPanel({ kind: "settings" })} className={`${secondaryButton} mt-5 w-full`}>戻る</button>
              )}
            </form>
          ) : null}

          {panel.kind === "quiz" ? (
            <form onSubmit={saveSettings} className="mt-4">
              <input type="hidden" name="intent" value="quiz" />
              <fieldset disabled={busy || !isOwner} className={isOwner ? "" : "opacity-55"}>
                <legend className="sr-only">みんなでクイズの設定</legend>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 transition hover:border-coral/35">
                  <input type="checkbox" name="balanceQuizContributors" defaultChecked={presentation.balanceQuizContributors} className={roundCheckbox} />
                  <span>
                    <strong className="block text-sm font-semibold">出題する思い出の数を投稿者ごとになるべく平等にする</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-ink/50">参加者のうち1枚以上投稿した人を対象に、最も投稿数が少ない人の枚数へそろえます。</span>
                  </span>
                </label>

                <div className="mt-5 space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                    <input type="radio" name="quizMode" value="random" checked={quizModeDraft === "random"} onChange={() => setQuizModeDraft("random")} className="mt-0.5 h-5 w-5 shrink-0 accent-coral" />
                    <span><strong className="block text-sm font-semibold">みんなでクイズ（ランダム）</strong><span className="mt-0.5 block text-[11px] leading-5 text-ink/50">これまでと同じ10問・各5秒で出題します。</span></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                    <input type="radio" name="quizMode" value="custom" checked={quizModeDraft === "custom"} onChange={() => setQuizModeDraft("custom")} className="mt-0.5 h-5 w-5 shrink-0 accent-coral" />
                    <span><strong className="block text-sm font-semibold">みんなでクイズ（カスタム）</strong><span className="mt-0.5 block text-[11px] leading-5 text-ink/50">方式ごとの問題数と制限時間を選びます。</span></span>
                  </label>
                </div>

                <div className={`mt-4 rounded-2xl border border-line bg-paper p-4 transition ${quizModeDraft === "custom" ? "" : "opacity-45"}`}>
                  <p className="text-xs font-semibold">方式ごとの問題数</p>
                  <div className="mt-3 space-y-3">
                    {[
                      ["quizMonthCount", "いつか", presentation.quizMonthCount],
                      ["quizPhotoToCaptionCount", "写真から一言", presentation.quizPhotoToCaptionCount],
                      ["quizCaptionToPhotoCount", "一言から写真", presentation.quizCaptionToPhotoCount],
                    ].map(([fieldName, label, current]) => (
                      <label key={String(fieldName)} className="flex items-center justify-between gap-4 text-sm">
                        <span>{label}</span>
                        <span className="flex items-center gap-2">
                          <select name={String(fieldName)} defaultValue={Number(current)} disabled={quizModeDraft !== "custom" || busy || !isOwner} className="h-10 min-w-16 rounded-xl border border-line bg-ivory px-2 text-center text-sm outline-none focus:border-coral">
                            {Array.from({ length: 11 }, (_, count) => <option key={count} value={count}>{count}</option>)}
                          </select>
                          <span className="text-xs text-ink/50">問</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-ink/45">3方式の合計が10問になるように設定してください。</p>

                  <p className="mt-5 text-xs font-semibold">制限時間</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[3, 5, 10].map((seconds) => (
                      <label key={seconds} className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line bg-ivory text-xs font-semibold">
                        <input type="radio" name="quizSecondsPerQuestion" value={seconds} defaultChecked={presentation.quizSecondsPerQuestion === seconds} disabled={quizModeDraft !== "custom" || busy || !isOwner} className="accent-coral" />
                        {seconds}秒
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>
              {settingsError ? <p role="alert" className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-600">{settingsError}</p> : null}
              {isOwner ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>戻る</button>
                  <button type="submit" disabled={busy} className="accent-gradient min-h-11 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-45">{busy ? "反映中…" : "反映"}</button>
                </div>
              ) : (
                <button type="button" onClick={() => showPanel({ kind: "settings" })} className={`${secondaryButton} mt-5 w-full`}>戻る</button>
              )}
            </form>
          ) : null}

          {panel.kind === "invite" && isOwner ? (
            <form action={submitAction(inviteSharedGroupMemberAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <p className="text-sm leading-6 text-ink/70">Memorimberに登録済みのメールアドレスを入力してください。</p>
              <label className="mt-4 block text-sm font-medium">メールアドレス
                <input data-dialog-autofocus type="email" name="email" autoComplete="email" required maxLength={320} disabled={busy} placeholder="friend@example.com" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-base outline-none placeholder:text-ink/40 focus:border-coral focus:ring-2 focus:ring-coral/10" />
              </label>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>戻る</button>
                <SharedGroupSubmitButton disabled={busy} pendingLabel="招待中…" className="!text-sm">招待を送る</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "remove" && isOwner ? (
            <form action={submitAction(removeSharedGroupMemberAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="userId" value={panel.member.userId} />
              <p className="break-words text-sm leading-6">
                <SharedMemberName displayName={panel.member.displayName} level={panel.member.level} isCurrentUser={panel.member.userId === userId} /> をこのグループから除外しますか？
              </p>
              <p className="mt-2 text-xs leading-6 text-ink/60">このメンバーが共有した思い出もグループから外れます。元の思い出と写真は残ります。</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="除外中…">除外する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "delete" && isOwner ? (
            <form action={submitAction(deleteSharedGroupAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <label className="flex items-start gap-3 text-sm leading-6">
                <input type="checkbox" name="confirm" value="delete" required disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-red-500" />
                <span>グループを削除することを確認しました。現在のメンバーが所有する元の思い出と写真は残ります。退会者の保持写真は、最後の共有先がなくなると削除されます。</span>
              </label>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="削除中…">削除する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "leave" && !isOwner ? (
            <form action={submitAction(leaveSharedGroupAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <fieldset disabled={busy}>
                <legend className="text-sm font-semibold">退出後の自分の写真</legend>
                <label className="mt-4 flex items-start gap-2 text-xs leading-6"><input type="radio" name="memoryHandling" value="keep" defaultChecked className="mt-1 accent-coral" /><span><strong className="block">共有したまま残す（おすすめ）</strong>メンバーは引き続き閲覧できます。</span></label>
                <label className="mt-3 flex items-start gap-2 text-xs leading-6"><input type="radio" name="memoryHandling" value="remove" className="mt-1 accent-coral" /><span><strong className="block">グループから外す</strong>共有関係だけを解除し、元の思い出と写真は残します。</span></label>
              </fieldset>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => showPanel({ kind: "settings" })} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="退出中…">退出する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}
        </SharedGroupDialog>
      ) : null}
    </>
  );
}

type ShareButtonProps = {
  groupId: string;
  name: string;
  memories: SharedMemoryChoice[];
};

export function SharedMemoryShareButton({ groupId, name, memories }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const showPicker = () => {
    setSelected(new Set());
    setOpen(true);
  };
  const close = () => {
    if (!pendingRef.current) setOpen(false);
  };
  const submit = async (formData: FormData) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    try {
      await addSharedMemoryAction(formData);
    } finally {
      pendingRef.current = false;
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <SharedAddButton ref={triggerRef} label="思い出を共有" aria-haspopup="dialog" onClick={showPicker} />
      {open ? (
        <SharedGroupDialog title="思い出を共有" subtitle={name} busy={busy} onClose={close} returnFocusRef={triggerRef}>
          <form action={submit} className="mt-4">
            <input type="hidden" name="groupId" value={groupId} />
            <p className="text-xs leading-6 text-ink/60">共有する思い出を選んでください。複数選択できます。</p>
            {memories.length === 0 ? <p className="mt-4 rounded-xl bg-paper p-5 text-center text-sm text-ink/60">追加できる思い出はありません。</p> : (
              <fieldset disabled={busy} className="shared-memory-picker mt-3">
                <legend className="sr-only">共有する思い出</legend>
                {memories.map((memory) => (
                  <label key={memory.id} className={`shared-memory-choice relative cursor-pointer overflow-hidden rounded-xl border bg-paper ${selected.has(memory.id) ? "border-coral ring-2 ring-coral/25" : "border-line"}`}>
                    <input type="checkbox" name="memoryId" value={memory.id} checked={selected.has(memory.id)} onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (checked) next.add(memory.id); else next.delete(memory.id);
                        return next;
                      });
                    }} className="absolute right-2 top-2 z-10 h-5 w-5 accent-coral" />
                    <div className="aspect-square overflow-hidden"><MemoryPhoto src={memory.displayUrl} alt="" className="h-full w-full object-cover" /></div>
                    <div className="p-2.5">
                      <span className="block text-[11px] text-ink/60">{formatShortDate(memory.date)}</span>
                      <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5">{memory.caption}</span>
                    </div>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="shared-memory-picker-footer mt-4 border-t border-line pt-3">
              <p role="status" className="mb-3 text-xs text-ink/60">{selected.size}件選択中</p>
              <SharedGroupSubmitButton disabled={busy || selected.size === 0} pendingLabel="共有中…" className="w-full !text-sm">選択した{selected.size}件を共有</SharedGroupSubmitButton>
            </div>
          </form>
        </SharedGroupDialog>
      ) : null}
    </>
  );
}
