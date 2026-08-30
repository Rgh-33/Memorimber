import { ChevronRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const configured = isSupabaseConfigured();
  let email: string | null = null;

  if (configured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="page-pad">
      <AppHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">YOUR ACCOUNT</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">アカウント</h1>
        <p className="mt-3 text-xs leading-6 text-ink/50">ログインに使用する情報を確認できます。</p>
      </section>

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
    </div>
  );
}
