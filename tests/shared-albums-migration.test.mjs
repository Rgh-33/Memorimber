import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260905010000_create_shared_albums.sql", import.meta.url),
  "utf8",
);

test("shared album tables keep membership and memory links unique without duplicating memories", () => {
  assert.match(migration, /create table public\.shared_albums[\s\S]*owner_id uuid not null[\s\S]*name text not null/);
  assert.match(migration, /create table public\.shared_album_members[\s\S]*primary key \(album_id, user_id\)/);
  assert.match(migration, /create table public\.shared_album_memories[\s\S]*memory_id uuid not null references public\.memories \(id\)[\s\S]*primary key \(album_id, memory_id\)/);
  assert.match(migration, /shared_album_members_one_owner_idx[\s\S]*where role = 'owner'/);
  assert.match(migration, /shared_album_members_role check \(role in \('owner', 'member'\)\)/);
  assert.match(migration, /char_length\(name\) between 1 and 60/);
  assert.doesNotMatch(migration, /create table public\.shared_album_memories[\s\S]*\b(?:caption|image_path)\b[\s\S]*create index shared_album_memories_memory_idx/);
});

test("album creation atomically installs an immutable owner membership", () => {
  assert.match(migration, /after insert on public\.shared_albums[\s\S]*execute function private\.add_shared_album_owner_membership\(\)/);
  assert.match(migration, /insert into public\.shared_album_members \(album_id, user_id, role\)[\s\S]*values \(new\.id, new\.owner_id, 'owner'\)/);
  assert.match(migration, /before update of owner_id on public\.shared_albums[\s\S]*prevent_shared_album_owner_change/);
  assert.match(migration, /grant select on table public\.shared_album_members to authenticated/);
});

test("RLS grants reads to formal members and writes only within ownership boundaries", () => {
  for (const table of ["shared_albums", "shared_album_members", "shared_album_memories"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(migration, /Members can view shared albums[\s\S]*is_shared_album_member\(id\)/);
  assert.match(migration, /Members can view fellow members[\s\S]*is_shared_album_member\(album_id\)/);
  assert.match(migration, /Members can view shared album memories[\s\S]*is_shared_album_member\(album_id\)/);
  assert.match(migration, /Members can add their own memories[\s\S]*memory\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /Owners can delete shared albums[\s\S]*owner_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]*on table public\.shared_album_members to authenticated/i);
});

test("existing memory and Storage owner policies are extended with read-only sharing", () => {
  assert.match(migration, /on public\.memories[\s\S]*for select[\s\S]*can_view_shared_memory\(id\)/);
  assert.match(migration, /on storage\.objects[\s\S]*for select[\s\S]*bucket_id = 'memory-images'[\s\S]*can_view_shared_memory_image\(name\)/);
  assert.doesNotMatch(migration, /Shared album members[^;]*(?:for update|for delete)/i);
  assert.doesNotMatch(migration, /grant[^;]*(?:update|delete)[^;]*storage\.objects/i);
});

test("recursive RLS helpers are isolated and hardened", () => {
  assert.match(migration, /create schema if not exists private/);
  for (const helper of [
    "is_shared_album_member",
    "is_shared_album_owner",
    "can_view_shared_memory",
    "can_view_shared_memory_image",
  ]) {
    assert.match(
      migration,
      new RegExp(`function private\\.${helper}\\([^)]*\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`),
    );
    assert.match(migration, new RegExp(`grant execute on function private\\.${helper}\\([^)]*\\) to authenticated`));
  }
  assert.match(migration, /revoke all on schema private from public, anon/);
});
