import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AppBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-4 grid h-9 w-9 place-items-center rounded-full border border-line bg-ivory text-ink transition hover:border-coral hover:bg-paper hover:text-coral"
      aria-label={label}
      title={label}
    >
      <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}
