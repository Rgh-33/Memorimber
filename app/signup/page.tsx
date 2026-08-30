import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthPageShell } from "@/components/auth-page-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ERROR_MESSAGES: Record<string, string> = {
  configuration: "Supabaseの接続情報がまだ設定されていません。バックエンド担当から公開URLと公開キーを受け取った後に利用できます。",
  missing_fields: "メールアドレスとパスワードを入力してください。",
  signup_failed: "登録できませんでした。入力内容を確認するか、時間を置いてもう一度お試しください。",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const next = getSafeAuthRedirect(typeof params.next === "string" ? params.next : null);
  const configured = isSupabaseConfigured();
  const notice = errorCode && ERROR_MESSAGES[errorCode]
    ? { tone: "error" as const, text: ERROR_MESSAGES[errorCode] }
    : !configured
      ? { tone: "info" as const, text: ERROR_MESSAGES.configuration }
      : undefined;

  return (
    <AuthPageShell
      title="新規登録"
      description="メールアドレスとパスワードで、Memorimberのアカウントを作成します。"
      notice={notice}
      footer={<>すでに登録済みの方は <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-coral hover:underline">ログイン</Link></>}
    >
      <form action={signup}>
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
            autoComplete="new-password"
            required
            disabled={!configured}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/15 disabled:cursor-not-allowed disabled:opacity-55"
            placeholder="パスワード"
          />
          <span className="mt-2 block text-[10px] leading-5 text-ink/40">必要な文字数などは、接続先のSupabase Auth設定に従います。</span>
        </label>
        <AuthSubmitButton disabled={!configured}>アカウントを作る</AuthSubmitButton>
      </form>
    </AuthPageShell>
  );
}
