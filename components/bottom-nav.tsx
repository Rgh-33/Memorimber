"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookImage, CircleUserRound, Home, Plus, Sparkles } from "lucide-react";

const items = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/album", label: "アルバム", icon: BookImage },
  { href: "/post", label: "投稿", icon: Plus, primary: true },
  { href: "/quiz", label: "クイズ", icon: Sparkles },
  { href: "/more", label: "その他", icon: CircleUserRound },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[76px] max-w-[430px] items-end justify-around border-t border-line/80 bg-ivory/95 px-3 pb-3 pt-2 backdrop-blur-md print:hidden" aria-label="メインナビゲーション">
      {items.map(({ href, label, icon: Icon, primary }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        if (primary) {
          return (
            <Link key={href} href={href} className="-mt-5 flex flex-col items-center gap-1" aria-label="思い出を投稿">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-card ring-4 ring-ivory transition-transform hover:-translate-y-0.5 active:scale-95">
                <Icon size={26} strokeWidth={2.2} />
              </span>
              <span className="text-[10px] font-bold text-coral">{label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-w-[52px] flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[10px] font-semibold transition-colors ${
              active ? "text-coral" : "text-ink/45 hover:text-ink/75"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
