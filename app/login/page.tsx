import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthPageShell } from "@/components/auth-page-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ERROR_MESSAGES: Record<string, string> = {
  configuration: "Supabaseの接続情報がまだ設定されていません。バックエンド担当から公開URLと公開キーを受け取った後に利用できます。",
  missing_fields: "メールアドレスとパスワードを入力してください。",
  invalid_credentials: "メールアドレスまたはパスワードを確認してください。",
  confirmation_failed: "メール確認リンクを確認できませんでした。もう一度ログインをお試しください。",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  check_email: "登録を受け付けました。確認メールが届く設定の場合は、メール内のリンクを開いてください。",
  signed_out: "ログアウトしました。",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const messageCode = typeof params.message === "string" ? params.message : "";
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//")
    ? params.next
    : "/";
  const configured = isSupabaseConfigured();
  const notice = errorCode && ERROR_MESSAGES[errorCode]
    ? { tone: "error" as const, text: ERROR_MESSAGES[errorCode] }
    : messageCode && SUCCESS_MESSAGES[messageCode]
      ? { tone: "success" as const, text: SUCCESS_MESSAGES[messageCode] }
      : !configured
        ? { tone: "info" as const, text: ERROR_MESSAGES.configuration }
        : undefined;

  return (
    <AuthPageShell
      title="ログイン"
      description="登録したメールアドレスとパスワードで、思い出の木へ戻ります。"
      notice={notice}
      footer={<>はじめての方は <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-coral hover:underline">新規登録</Link></>}
    >
      <form action={login}>
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-xs font-semibold text-ink">メールアドレス</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            disabled={!configured}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/15 disabled:cursor-not-allowed disabled:opacity-55"
            placeholder="you@example.com"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink">パスワード</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={!configured}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/15 disabled:cursor-not-allowed disabled:opacity-55"
            placeholder="パスワード"
          />
        </label>
        <AuthSubmitButton disabled={!configured}>ログインする</AuthSubmitButton>
      </form>
    </AuthPageShell>
  );
}
