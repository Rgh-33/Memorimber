"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandHomeLink } from "@/components/brand-home-link";

export function SettingsHeader() {
  const router = useRouter();

  return (
    <header className="flex h-10 items-center justify-between">
      <button
        type="button"
        onClick={() => router.back()}
        className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-ink transition hover:border-coral hover:bg-paper hover:text-coral"
        aria-label="ひとつ前の画面へ戻る"
      >
        <ArrowLeft size={20} strokeWidth={1.8} />
      </button>
      <BrandHomeLink className="rounded-lg px-1.5 py-2 transition hover:bg-paper" />
    </header>
  );
}
