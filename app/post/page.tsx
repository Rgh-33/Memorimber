import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemoryForm } from "@/components/memory-form";

export default function PostPage() {
  return (
    <div className="page-pad">
      <div className="mb-7 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 text-sm font-bold text-ink/60 hover:text-ink"><ArrowLeft size={17} /> 戻る</Link>
        <span className="text-sm font-black tracking-[0.08em] text-ink">思い出投稿</span>
        <span className="w-12" />
      </div>
      <MemoryForm compact />
    </div>
  );
}
