"use client";

import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#edf5fd] text-ink">
      <div className="app-shell relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-white shadow-phone">
        <main className="min-h-screen pb-[92px]">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
