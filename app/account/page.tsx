import { AlertTriangle, ChevronRight, KeyRound, Mail, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { deleteAccountAction, retryAccountDeletionAction } from "./actions";
import { AppHeader } from "@/components/app-header";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { getMyAccountDeletionJob, type AccountDeletionJob, type AccountDeletionJobStatus } from "@/lib/supabase/account-deletion";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const JOB_STATUS_LABELS: Record<AccountDeletionJobStatus, string> = {
  pending: "削除待ち",
  processing: "削除処理中",
  ready_for_auth: "アカウント削除待ち",
  failed: "再試行待ち",
  completed: "完了",
};

export default async function AccountPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();
  const status = typeof query.status === "string" ? query.status : null;
  const actionError = typeof query.error === "string" ? query.error : null;
  let email: string | null = null;
  let deletionJob: AccountDeletionJob | null = null;
  let jobError: string | null = null;

  if (configured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? null;
    if (user) {
      try {
        deletionJob = await getMyAccountDeletionJob(supabase);
      } catch (error) {
        jobError = error instanceof Error ? error.message : "削除処理の状態を確認できませんでした。";
      }
    }
  }

  return (
    <div className="page-pad">
      <AppHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">YOUR ACCOUNT</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">アカウント</h1>
        <p className="mt-3 text-xs leading-6 text-ink/50">ログインに使用する情報を確認できます。</p>
      </section>

      {status ? <p role="status" className="auth-notice auth-notice--success mt-6">{status}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {jobError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{jobError}</p> : null}

      <section className="settings-card mt-7">
        <div className="flex items-start gap-3">
          <span className="settings-section-icon"><Mail size={19} strokeWidth={1.7} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink">メールアドレス</p>
            <p className="mt-2 break-all text-sm leading-6 text-ink/65">
              {email ?? (configured ? "メールアドレスを取得できませんでした" : "Supabase接続後に表示されます")}
            </p>
          </div>
        </div>

        <div className="my-5 h-px bg-line" aria-hidden="true" />

        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3.5 text-left transition hover:border-coral hover:bg-coral/5"
        >
          <span className="flex items-center gap-3">
            <KeyRound size={19} className="text-coral" strokeWidth={1.7} />
            <span className="text-sm font-semibold text-ink">パスワードを変更</span>
          </span>
          <ChevronRight size={18} className="text-ink/35" />
        </button>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-coral" strokeWidth={1.7} />
        <p className="text-[11px] leading-6 text-ink/50">パスワード変更機能は、バックエンドとの接続確認後に追加します。</p>
      </section>

      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/60 p-5" aria-labelledby="delete-account-title">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle size={19} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="delete-account-title" className="text-sm font-semibold text-ink">アカウントを削除</h2>
            <p className="mt-1 text-[11px] leading-5 text-ink/55">この操作は取り消せません。内容を確認してから実行してください。</p>
          </div>
        </div>

        {deletionJob ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-paper p-4">
            <p className="text-xs font-semibold text-ink">現在の状態：{JOB_STATUS_LABELS[deletionJob.status]}</p>
            <p className="mt-2 text-[11px] leading-5 text-ink/55">
              {deletionJob.retainSharedMemories
                ? "他のユーザーが所有するグループで共有中の思い出だけを保持します。"
                : "自分の思い出と写真をすべて削除します。"}
              途中で失敗した処理は、再試行または日次処理で続きから実行されます。
            </p>
            <form action={retryAccountDeletionAction} className="mt-4">
              <SharedGroupSubmitButton tone="danger" pendingLabel="再試行中…" className="w-full">
                <span className="flex items-center justify-center gap-2"><RefreshCw size={15} />削除処理を再試行</span>
              </SharedGroupSubmitButton>
            </form>
          </div>
        ) : (
          <form action={deleteAccountAction} className="mt-5">
            <label className="block text-xs font-medium text-ink">
              現在のメールアドレス
              <input
                type="email"
                value={email ?? ""}
                readOnly
                aria-readonly="true"
                className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm text-ink/60 outline-none"
              />
            </label>
            <label className="mt-4 block text-xs font-medium text-ink">
              現在のパスワード
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-[11px] leading-5 text-ink/65">
              <input type="checkbox" name="retainSharedMemories" className="mt-1 accent-coral" />
              <span>
                <strong className="block text-ink">他の人のグループで共有中の思い出を残す</strong>
                オンにすると、その思い出と写真だけが閲覧専用で残ります。自分が所有するグループは削除されます。
              </span>
            </label>
            <label className="mt-4 block text-xs font-medium text-ink">
              確認のため「削除」と入力
              <input
                type="text"
                name="confirmation"
                required
                autoComplete="off"
                pattern="削除"
                className="mt-2 w-full rounded-xl border border-red-200 bg-paper px-4 py-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>
            <SharedGroupSubmitButton tone="danger" pendingLabel="削除を開始中…" className="mt-4 w-full" disabled={!configured || !email}>
              <span className="flex items-center justify-center gap-2"><Trash2 size={15} />アカウントを削除</span>
            </SharedGroupSubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
