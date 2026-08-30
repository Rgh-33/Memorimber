"use client";

import { useEffect, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { useProcessing } from "@/lib/processing-context";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { startProcessing, stopProcessing } = useProcessing();

  useEffect(() => {
    stopProcessing();
  }, [pathname, stopProcessing]);

  const handleNavigationStart = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin) return;
    if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;
    startProcessing();
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-ink">
      <div className="app-shell relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-ivory shadow-phone" onClickCapture={handleNavigationStart}>
        <main className="min-h-screen pb-[92px]">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
