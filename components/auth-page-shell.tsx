import Link from "next/link";
import { CupSoda } from "lucide-react";

export function AuthPageShell({
  title,
  description,
  notice,
  children,
  footer,
}: {
  title: string;
  description: string;
  notice?: { tone: "error" | "success" | "info"; text: string };
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col px-5 py-8">
      <Link href="/login" className="mx-auto flex items-center gap-2 text-coral" aria-label="Memorimberログインへ">
        <CupSoda size={29} strokeWidth={1.5} />
        <span className="text-base font-semibold">Memorimber</span>
      </Link>

      <main className="my-auto py-8">
        <section className="mx-auto max-w-sm rounded-[24px] border border-line bg-ivory p-6 shadow-card">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">WELCOME</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[0.08em] text-ink">{title}</h1>
          <p className="mt-3 text-xs leading-6 text-ink/55">{description}</p>

          {notice && (
            <p className={`auth-notice auth-notice--${notice.tone} mt-5`} role={notice.tone === "error" ? "alert" : "status"}>
              {notice.text}
            </p>
          )}

          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-xs text-ink/55">{footer}</div>
        </section>
      </main>

      <p className="text-center text-[10px] leading-5 text-ink/35">大切な思い出を、あなたのアカウントで守ります。</p>
    </div>
  );
}
