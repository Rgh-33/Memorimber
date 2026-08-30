"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandHomeLink } from "@/components/brand-home-link";
import { useProcessing } from "@/lib/processing-context";

export function SettingsHeader() {
  const router = useRouter();
  const { startProcessing } = useProcessing();

  return (
    <header>
      <div className="flex h-10 items-center">
        <BrandHomeLink />
      </div>
      <button
        type="button"
        onClick={() => {
          startProcessing();
          router.back();
        }}
        className="mt-4 grid h-9 w-9 place-items-center rounded-full border border-line bg-ivory text-ink transition hover:border-coral hover:bg-paper hover:text-coral"
        aria-label="ひとつ前の画面へ戻る"
      >
        <ArrowLeft size={20} strokeWidth={1.8} />
      </button>
    </header>
  );
}
