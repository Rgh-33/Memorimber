"use client";

import Link from "next/link";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandHomeLink } from "@/components/brand-home-link";

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="flex h-10 items-center justify-between">
        <BrandHomeLink />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-ink transition hover:bg-paper hover:text-coral"
          aria-label="メニューを開く"
          aria-expanded={menuOpen}
          aria-controls="app-side-menu"
        >
          <Menu size={23} strokeWidth={1.7} />
        </button>
      </header>

      {menuOpen && (
        <div className="app-menu-layer" role="presentation">
          <button type="button" className="app-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="メニューを閉じる" />
          <aside id="app-side-menu" className="app-side-menu" role="dialog" aria-modal="true" aria-label="メニュー">
            <div className="flex items-center justify-between border-b border-line px-3 py-4">
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
              <button type="button" className="app-side-menu-item">
                <LogOut size={17} />
                <span>ログアウト</span>
              </button>
              <Link href="/settings" onClick={() => setMenuOpen(false)} className="app-side-menu-item">
                <Settings size={17} />
                <span>設定</span>
              </Link>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
