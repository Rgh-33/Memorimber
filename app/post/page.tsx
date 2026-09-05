import { MemoryForm } from "@/components/memory-form";

export default function PostPage() {
  return (
    <div className="page-pad">
      <section className="pb-5 pt-7 text-center">
        <h1 className="font-sans text-[25px] font-medium tracking-[0.08em] text-ink">思い出を追加</h1>
        <p className="mt-2 text-xs text-ink/45">今日の小さな出来事を残そう</p>
      </section>
      <MemoryForm compact />
    </div>
  );
}
