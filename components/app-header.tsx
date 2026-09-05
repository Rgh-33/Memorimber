"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Info, LogOut, Menu, MoreHorizontal, RotateCcw, Settings, Sparkles, UserCog, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/auth/actions";
import { BrandHomeLink } from "@/components/brand-home-link";
import { useMemories } from "@/lib/memories-context";
import { useProcessing } from "@/lib/processing-context";
import { useProfile } from "@/lib/profile-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useNotifications } from "@/lib/notifications-context";

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { resetDemo } = useMemories();
  const { startProcessing } = useProcessing();
  const { avatarDataUrl, nickname } = useProfile();
  const { unreadCount } = useNotifications();
  useBodyScrollLock(menuOpen);

  useEffect(() => {
    if (!menuOpen) return;

    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="app-header flex h-[62px] items-center justify-between px-5 pt-[22px] print:hidden">
        <BrandHomeLink />
        <div className="flex items-center gap-1.5">
          <Link
            href="/profile"
            className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-coral/55 bg-paper text-coral shadow-sm transition hover:border-coral hover:ring-2 hover:ring-coral/15"
            aria-label={`${nickname || "自分"}のプロフィールを開く`}
          >
            {avatarDataUrl ? (
              <Image src={avatarDataUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
            ) : (
              <UserRound size={18} strokeWidth={1.65} />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="relative rounded-lg p-2 text-ink transition hover:bg-paper hover:text-coral"
            aria-label={unreadCount > 0 ? `メニューを開く、未読通知${unreadCount}件` : "メニューを開く"}
            aria-expanded={menuOpen}
            aria-controls="app-side-menu"
          >
            <Menu size={23} strokeWidth={1.7} />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-ivory bg-coral" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="app-menu-layer" role="presentation">
          <button type="button" className="app-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="メニューを閉じる" />
          <aside id="app-side-menu" className="app-side-menu" role="dialog" aria-modal="true" aria-label="メニュー">
            <div className="flex items-center justify-between px-3 py-4">
              <span className="text-[10px] font-semibold tracking-[0.16em] text-ink/45">MENU</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-ink/65 transition hover:bg-paper hover:text-coral"
                aria-label="メニューを閉じる"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="grid" aria-label="サイドメニュー">
              <Link href="/profile" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <UserRound size={17} />
                <span>プロフィール</span>
              </Link>
              <Link href="/notifications" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <Bell size={17} />
                <span>通知</span>
                {unreadCount > 0 ? (
                  <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-coral px-1.5 py-0.5 text-[9px] leading-4 text-white" aria-label={`未読${unreadCount}件`}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Link>
              <div className="app-side-menu-divider" aria-hidden="true" />
              <Link href="/post" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <Sparkles size={17} />
                <span>新しい思い出を残す</span>
              </Link>
              <Link href="/more#about" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <Info size={17} />
                <span>このプロトタイプについて</span>
              </Link>
              <Link href="/more" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <MoreHorizontal size={17} />
                <span>その他</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  resetDemo();
                  setMenuOpen(false);
                }}
                className="app-side-menu-item"
              >
                <RotateCcw size={17} />
                <span>デモデータを初期化</span>
              </button>
              <div className="app-side-menu-divider" aria-hidden="true" />
              <Link href="/settings" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <Settings size={17} />
                <span>設定</span>
              </Link>
              <Link href="/account" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <UserCog size={17} />
                <span>アカウント</span>
              </Link>
              <form
                action={logout}
                onSubmit={() => {
                  startProcessing();
                  setMenuOpen(false);
                }}
              >
                <button type="submit" className="app-side-menu-item">
                  <LogOut size={17} />
                  <span>ログアウト</span>
                </button>
              </form>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
