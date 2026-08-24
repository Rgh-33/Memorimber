"use client";

import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e9e1d5] text-ink">
      <div className="app-shell relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-ivory shadow-phone">
        <main className="min-h-screen pb-24">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
