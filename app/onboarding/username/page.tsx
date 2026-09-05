import { logout } from "@/app/auth/actions";
import { setInitialUsername } from "@/app/onboarding/username/actions";
import { AuthPageShell } from "@/components/auth-page-shell";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import {
  getSafePostUsernameRedirect,
  PROFILE_USERNAME_MAX_LENGTH,
} from "@/lib/profile-username";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ERROR_MESSAGES: Record<string, string> = {
  configuration: "Supabaseの接続情報がまだ設定されていません。",
  missing_username: "ユーザー名を入力してください。",
  username_too_long: `ユーザー名は${PROFILE_USERNAME_MAX_LENGTH}文字以内で入力してください。`,
  save_failed: "ユーザー名を保存できませんでした。時間を置いてもう一度お試しください。",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function UsernameOnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const next = getSafePostUsernameRedirect(typeof params.next === "string" ? params.next : null);
  const configured = isSupabaseConfigured();
  const notice = errorCode && ERROR_MESSAGES[errorCode]
    ? { tone: "error" as const, text: ERROR_MESSAGES[errorCode] }
    : !configured
      ? { tone: "info" as const, text: ERROR_MESSAGES.configuration }
      : undefined;

  return (
    <AuthPageShell
      title="ユーザー名を決める"
      description="グループのメンバーに表示する名前です。同じ名前のユーザーがいても登録できます。"
      notice={notice}
      footer={(
        <form action={logout}>
          <button type="submit" className="font-semibold text-coral hover:underline">別のアカウントでログイン</button>
        </form>
      )}
    >
      <form action={setInitialUsername}>
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="text-xs font-semibold text-ink">ユーザー名</span>
          <input
            type="text"
            name="username"
            autoComplete="nickname"
            required
            maxLength={PROFILE_USERNAME_MAX_LENGTH}
            disabled={!configured}
            autoFocus
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/15 disabled:cursor-not-allowed disabled:opacity-55"
            placeholder="メモリさん"
          />
          <span className="mt-2 block text-[10px] leading-5 text-ink/40">
            {PROFILE_USERNAME_MAX_LENGTH}文字以内。あとからプロフィールで変更できます。
          </span>
        </label>
        <AuthSubmitButton disabled={!configured}>Memorimberをはじめる</AuthSubmitButton>
      </form>
    </AuthPageShell>
  );
}
