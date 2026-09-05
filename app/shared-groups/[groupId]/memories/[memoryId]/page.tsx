import Link from "next/link";
import { ArrowLeft, CalendarDays, Tag, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MemoryPhoto } from "@/components/memory-photo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, isUuid, listSharedAlbumMembers, loadSharedAlbumMemoryEntries } from "@/lib/supabase/shared-albums";
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

  const [album, memoryResult, members] = await Promise.all([
    getSharedAlbum(client, groupId),
    loadSharedAlbumMemoryEntries(client, groupId),
    listSharedAlbumMembers(client, groupId),
  ]);
  const entry = memoryResult.entries.find((candidate) => candidate.memory.id === memoryId);
  if (!album || !entry) notFound();
  const contributor = members.find((member) => member.userId === entry.addedBy)?.displayName ?? "メンバー";
  const memory = entry.memory;

  return (
    <div className="page-pad">
      <AppHeader />
      <Link href={`/shared-groups/${groupId}`} className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />{album.name}へ</Link>

      {memoryResult.warning ? <p role="status" className="auth-notice auth-notice--info mt-5">{memoryResult.warning}</p> : null}

      <article className="mt-5 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
        <div className="aspect-[4/3] overflow-hidden bg-ivory">
          <MemoryPhoto src={memory.imageUrl} alt={memory.caption} detailed className="h-full w-full object-contain" />
        </div>
        <div className="p-5">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-coral">READ ONLY · {contributor}さんが共有</p>
          <h1 className="mt-3 whitespace-pre-wrap text-xl font-semibold leading-8 text-ink">{memory.caption}</h1>
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
          <p className="mt-6 rounded-xl bg-ivory px-4 py-3 text-[10px] leading-5 text-ink/45">共有された思い出は閲覧専用です。編集・削除・表示設定は写真の所有者だけが行えます。</p>
        </div>
      </article>
    </div>
  );
}
