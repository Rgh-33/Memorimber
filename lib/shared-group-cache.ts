"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSharedAlbum, loadSharedAlbumMemoryEntries, loadSharedAlbumMemoryDetail, renewSharedMemoryUrls, type SharedAlbumMemoryDetailResult, type SharedAlbum, type SharedAlbumMemoryResult } from "@/lib/supabase/shared-albums";
import type { GroupProfile } from "@/lib/supabase/group-profiles";
import type { SharedGroupPresentation } from "@/components/shared-group-presentation";

export type SignedUrlCache = Map<string, { url: string; expiresAt: number }>;
type Versions = { photos: number; settings: number; members: string | number };
export type GroupCache = {
  versions?: Versions; album?: SharedAlbum; photos?: SharedAlbumMemoryResult;
  presentation?: SharedGroupPresentation & { iconExpiresAt?: number }; members?: GroupProfile[];
  details?: Record<string, SharedAlbumMemoryDetailResult>;
  memberExpiresAt?: number; error?: string; forbidden?: boolean;
  urls: SignedUrlCache;
};
const cache = new Map<string, GroupCache>();
const pending = new Map<string, Promise<void>>();
const detailPending = new Map<string, Promise<SharedAlbumMemoryDetailResult | null>>();
const listeners = new Set<() => void>();
let owner: string | null = null;
let generation = 0;
const EMPTY: GroupCache = { urls: new Map() };
export function subscribeGroupCache(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() { for (const listener of listeners) listener(); }
export function clearSharedGroupCache() { generation++; owner = null; cache.clear(); pending.clear(); detailPending.clear(); notify(); }
export function getGroupCache(groupId: string) { return owner ? cache.get(`${owner}:${groupId}`) ?? EMPTY : EMPTY; }
export function getEmptyGroupCache() { return EMPTY; }
class GroupAccessLost extends Error {}
async function jsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 404 || response.status === 403) throw new GroupAccessLost("グループが見つからないか、閲覧する権限がありません。");
  if (!response.ok) throw new Error("グループを読み込めませんでした。");
  return response.json() as Promise<T>;
}
export function invalidateGroup(groupId: string) { void refreshGroup(groupId); }
export async function refreshGroup(groupId: string, needPhotos = false, recheckAfterPending = false): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const requestGeneration = generation;
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  if (requestGeneration !== generation) return;
  if (!user) { clearSharedGroupCache(); return; }
  if (owner && owner !== user.id) clearSharedGroupCache();
  owner = user.id;
  const key = `${user.id}:${groupId}`;
  if (pending.has(key)) { await pending.get(key); if (recheckAfterPending) return refreshGroup(groupId, needPhotos); if (needPhotos && !getGroupCache(groupId).photos && !getGroupCache(groupId).forbidden && !getGroupCache(groupId).error) return refreshGroup(groupId, true); return; }
  const epoch = generation;
  const promise = (async () => {
    const old: GroupCache = cache.get(key) ?? { urls: new Map() };
    try {
      const { data, error } = await client.rpc("get_shared_group_versions", { p_group: groupId });
      if (error) throw error;
      if (!data) {
        old.urls.clear();
        if (epoch === generation) { cache.set(key, { urls: new Map(), forbidden: true, error: "グループが見つからないか、閲覧する権限がありません。" }); notify(); }
        return;
      }
      const versions = data as Versions;
      const next: GroupCache = { ...old, versions, error: undefined, forbidden: false };
      const now = Date.now();
      await Promise.all([
        (async () => {
          if (!old.presentation || old.versions?.settings !== versions.settings || (old.presentation.iconDataUrl && (old.presentation.iconExpiresAt ?? 0) < now + 60000)) {
            const [presentation, album] = await Promise.all([
              fetch(`/api/shared-groups/${groupId}/presentation`, { cache: "no-store" }).then(jsonResponse<NonNullable<GroupCache["presentation"]>>),
              getSharedAlbum(client, groupId),
            ]);
            next.presentation = presentation; next.album = album ?? undefined;
          }
        })(),
        (async () => {
          if (!old.members || old.versions?.members !== versions.members || (old.memberExpiresAt ?? 0) < now + 60000) {
            next.members = await fetch(`/api/shared-groups/${groupId}/members`, { cache: "no-store" }).then(jsonResponse<GroupProfile[]>);
            next.memberExpiresAt = now + 3600000;
          }
        })(),
        (async () => {
          if (needPhotos && (!old.photos || old.versions?.photos !== versions.photos)) {
            next.photos = await loadSharedAlbumMemoryEntries(client, groupId, next.urls);
            const retained = new Set(next.photos.entries.flatMap(({ memory }) => [memory.imagePath, memory.thumbnailPath]).filter(Boolean));
            for (const path of next.urls.keys()) if (!retained.has(path)) next.urls.delete(path);
          }
          else if (old.versions?.photos !== versions.photos) next.photos = undefined;
          else if (needPhotos && old.photos && old.photos.entries.some(({ memory }) => (old.urls.get(memory.thumbnailPath ?? memory.imagePath ?? "")?.expiresAt ?? Infinity) < now + 60000)) next.photos = await renewSharedMemoryUrls(client, old.photos, next.urls);
          if (old.versions?.photos !== versions.photos) next.details = undefined;
        })(),
      ]);
      if (epoch === generation) { cache.set(key, next); notify(); }
    } catch (cause) {
      if (epoch === generation) {
        if (cause instanceof GroupAccessLost) { old.urls.clear(); cache.set(key, { urls: new Map(), forbidden: true, error: cause.message }); }
        else cache.set(key, { ...old, error: "グループを読み込めませんでした。" });
        notify();
      }
    }
  })();
  pending.set(key, promise);
  try { await promise; } finally { if (epoch === generation) pending.delete(key); }
}
// Realtime is only an invalidation signal; payload data never enters the cache.
const watches = new Map<string, { count: number; photoUsers: number; stop: () => void }>();
export function watchGroup(groupId: string, needPhotos: boolean) {
  if (!isSupabaseConfigured()) return () => {};
  let watch = watches.get(groupId);
  if (!watch) {
    const client = createClient();
    const refresh = () => { void refreshGroup(groupId, (watches.get(groupId)?.photoUsers ?? 0) > 0, true); };
    const channel = client.channel(`group-cache:${groupId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_group_versions", filter: `group_id=eq.${groupId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profile_progress" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_identity_versions" }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    window.addEventListener("focus", refresh);
    window.addEventListener("memorimber:shared-invalidated", refresh);
    watch = { count: 0, photoUsers: 0, stop: () => {
      void client.removeChannel(channel);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("memorimber:shared-invalidated", refresh);
    } };
    watches.set(groupId, watch);
  }
  watch.count++;
  if (needPhotos) watch.photoUsers++;
  void refreshGroup(groupId, watch.photoUsers > 0, true);
  return () => {
    if (!watch) return;
    watch.count--;
    if (needPhotos) watch.photoUsers--;
    if (!watch.count) { watch.stop(); watches.delete(groupId); }
  };
}

export async function loadCachedSharedDetail(groupId: string, memoryId: string) {
  await refreshGroup(groupId);
  const value = getGroupCache(groupId);
  if (value.forbidden) return null;
  const existing = value.details?.[memoryId];
  if (existing && (value.urls.get(existing.entry.memory.imagePath ?? "")?.expiresAt ?? 0) > Date.now() + 60000) return existing;
  const key = `${owner}:${groupId}:${memoryId}:${value.versions?.photos}`;
  const existingRequest = detailPending.get(key);
  if (existingRequest) return existingRequest;
  const epoch = generation;
  const request = (async () => {
    const result = await loadSharedAlbumMemoryDetail(createClient(), groupId, memoryId, value.urls);
    const current = getGroupCache(groupId);
    if (epoch !== generation || current.forbidden || current.versions?.photos !== value.versions?.photos) return null;
    if (result && owner) {
      cache.set(`${owner}:${groupId}`, { ...current, details: { ...current.details, [memoryId]: result } });
      notify();
    }
    return result;
  })();
  detailPending.set(key, request);
  try { return await request; } finally { detailPending.delete(key); }
}
