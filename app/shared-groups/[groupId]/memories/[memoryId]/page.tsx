import { CalendarDays, Tag, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AppBackLink } from "@/components/app-back-link";
import { MemoryPhoto } from "@/components/memory-photo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid, loadSharedAlbumMemoryDetail } from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ groupId: string; memoryId: string }> };

function longDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export default async function SharedMemoryDetailPage({ params }: PageProps) {
  const { groupId, memoryId } = await params;
  if (!isUuid(groupId) || !isUuid(memoryId)) notFound();
  if (!isSupabaseConfigured()) {
    return <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>;
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}/memories/${memoryId}` })}`);

  const [album, memoryResult] = await Promise.all([
    getSharedAlbum(client, groupId),
    loadSharedAlbumMemoryDetail(client, groupId, memoryId),
  ]);
  const entry = memoryResult?.entry;
  if (!album || !entry) notFound();
  const memory = entry.memory;

  return (
    <div className="page-pad">
      <AppHeader />
      <AppBackLink href={`/shared-groups/${groupId}`} label={`${album.name}へ戻る`} />

      {memoryResult?.warning ? <p role="status" className="auth-notice auth-notice--info mt-5">{memoryResult.warning}</p> : null}

      <article className="mt-5 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
        <div className="overflow-hidden bg-paper">
          <MemoryPhoto src={memory.imageUrl} alt={memory.caption} detailed className="block h-auto w-full bg-paper object-contain" />
        </div>
        <div className="p-5">
          <h1 className="whitespace-pre-wrap text-xl font-semibold leading-8 text-ink">{memory.caption}</h1>
          <dl className="mt-5 grid gap-3 text-xs text-ink/60">
            <div className="flex items-center gap-2"><CalendarDays size={15} className="text-coral" /><dt className="sr-only">日付</dt><dd>{longDate(memory.date)}</dd></div>
            {memory.people.length > 0 ? <div className="flex items-start gap-2"><Users size={15} className="mt-0.5 shrink-0 text-coral" /><dt className="sr-only">人物</dt><dd>{memory.people.join("、")}</dd></div> : null}
            {memory.tags.length > 0 ? <div className="flex items-start gap-2"><Tag size={15} className="mt-0.5 shrink-0 text-coral" /><dt className="sr-only">タグ</dt><dd>{memory.tags.join("、")}</dd></div> : null}
          </dl>
          {memory.letter ? (
            <section className="mt-6 border-t border-line pt-5" aria-labelledby="shared-memory-letter-title">
              <h2 id="shared-memory-letter-title" className="text-xs font-semibold text-ink">この思い出に残した手紙</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/70">{memory.letter}</p>
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}
