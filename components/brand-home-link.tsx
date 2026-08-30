"use client";

import Link from "next/link";
import { Sprout } from "lucide-react";
import { useProcessing } from "@/lib/processing-context";

export function BrandHomeLink({ className = "" }: { className?: string }) {
  const { isProcessing } = useProcessing();

  return (
    <Link
      href="/"
      className={`brand-home-link flex items-center gap-2 ${className}`}
      data-processing={isProcessing ? "true" : "false"}
      aria-label={isProcessing ? "処理中・思い出の木へ戻る" : "思い出の木へ戻る"}
    >
      <Sprout size={24} className="text-coral" strokeWidth={1.8} />
      <span className="text-sm font-semibold tracking-[-0.01em] text-coral">Memorimber</span>
    </Link>
  );
}
