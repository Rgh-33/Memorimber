import Link from "next/link";
import { Sprout } from "lucide-react";

export function BrandHomeLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label="思い出の木へ戻る">
      <Sprout size={24} className="text-coral" strokeWidth={1.8} />
      <span className="text-sm font-semibold tracking-[-0.01em] text-coral">Memorimber</span>
    </Link>
  );
}
