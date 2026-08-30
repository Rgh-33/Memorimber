import Link from "next/link";
import { Menu, Sprout } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex h-10 items-center justify-between">
      <Link href="/" className="flex items-center gap-2" aria-label="Memorimber ホーム">
        <Sprout size={24} className="text-coral" strokeWidth={1.8} />
        <span className="text-sm font-semibold tracking-[-0.01em] text-ink">Memorimber</span>
      </Link>
      <Link href="/more" className="rounded-lg p-2 text-ink transition hover:bg-paper hover:text-coral" aria-label="メニュー">
        <Menu size={23} strokeWidth={1.7} />
      </Link>
    </header>
  );
}
