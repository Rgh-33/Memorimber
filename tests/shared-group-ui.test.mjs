import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createQuizQuestions } from "../lib/quiz.ts";
import {
  loadSharedAlbumMemories,
  loadSharedAlbumMemoryDetail,
  loadSharedAlbumMemoryEntries,
  listSharedAlbumMembers,
  normalizeSharedAlbumName,
  renameSharedAlbum,
} from "../lib/supabase/shared-albums.ts";

const ALBUM_ID = "10000000-0000-4000-8000-000000000001";
const OWNER_ID = "20000000-0000-4000-8000-000000000002";

function loaderHarness({ denySecondPath = true } = {}) {
  const rows = [
    {
      album_id: ALBUM_ID,
      memory_id: "40000000-0000-4000-8000-000000000004",
      added_by: OWNER_ID,
      created_at: "2026-09-05T01:00:00Z",
      memory: {
        id: "40000000-0000-4000-8000-000000000004",
        user_id: OWNER_ID,
        image_path: `${OWNER_ID}/one.jpg`,
        thumbnail_path: `${OWNER_ID}/thumbnails/one.webp`,
        caption: "一枚目",
        memory_date: "2026-09-01",
        people: ["家族"],
        tags: [],
        letter: "",
        created_at: "2026-09-01T00:00:00Z",
      },
    },
    {
      album_id: ALBUM_ID,
      memory_id: "50000000-0000-4000-8000-000000000005",
      added_by: null,
      added_by_display_name: "退会した人",
      created_at: "2026-09-05T02:00:00Z",
      memory: {
        id: "50000000-0000-4000-8000-000000000005",
        user_id: null,
        image_path: "retained/50000000-0000-4000-8000-000000000005/original.jpg",
        caption: "二枚目",
        memory_date: "2026-09-02",
        people: [],
        tags: ["旅行"],
        letter: "また行こう",
        created_at: "2026-09-02T00:00:00Z",
      },
    },
  ];
  const signedPathCalls = [];
  const client = {
    from(table) {
      assert.equal(table, "shared_album_memories");
      const filters = new Map();
      return {
        select() { return this; },
        eq(column, value) { filters.set(column, value); return this; },
        order() { return this; },
        async range() {
          return { data: rows.filter((row) => [...filters].every(([column, value]) => row[column] === value)), error: null };
        },
        async maybeSingle() {
          const matches = rows.filter((row) => [...filters].every(([column, value]) => row[column] === value));
          return { data: matches[0] ?? null, error: null };
        },
      };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "memory-images");
        return {
          async createSignedUrls(paths, expiresIn) {
            assert.equal(expiresIn, 3600);
            signedPathCalls.push([...paths]);
            return {
              data: paths.map((path, index) => !denySecondPath || index === 0
                ? { path, signedUrl: `https://signed.invalid/${path}`, error: null }
                : { path, signedUrl: null, error: { message: "denied" } }),
              error: null,
            };
          },
        };
      },
    },
  };
  return { client, rows, signedPathCalls };
}

test("shared-memory loader preserves metadata when one signed URL fails", async () => {
  const { client, rows, signedPathCalls } = loaderHarness();
  const result = await loadSharedAlbumMemoryEntries(client, ALBUM_ID);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].memory.imageUrl, "");
  assert.match(result.entries[0].memory.thumbnailUrl, /signed\.invalid/);
  assert.equal(result.entries[1].memory.imageUrl, "");
  assert.equal(result.entries[1].memory.letter, "また行こう");
  assert.equal(result.entries[1].memoryOwnerId, null);
  assert.equal(result.entries[1].contributorName, "退会した人");
  assert.match(result.warning, /一部の写真/);
  assert.deepEqual(signedPathCalls, [[rows[0].memory.thumbnail_path, rows[1].memory.image_path]]);
  assert.ok(!signedPathCalls.flat().includes(rows[0].memory.image_path));
});

test("shared-memory loader result can be passed directly to the existing quiz generator", async () => {
  const memories = await loadSharedAlbumMemories(loaderHarness().client, ALBUM_ID);
  const questions = createQuizQuestions(memories, 2, ["month"], () => 0.25);
  assert.equal(memories.length, 2);
  assert.equal(questions.length, 2);
  const availableMemoryId = memories.find((memory) => memory.thumbnailUrl ?? memory.imageUrl)?.id;
  assert.ok(questions.every((question) => question.memoryId === availableMemoryId));
});

test("shared-memory detail signs only the selected original image", async () => {
  const { client, rows, signedPathCalls } = loaderHarness({ denySecondPath: false });
  const result = await loadSharedAlbumMemoryDetail(client, ALBUM_ID, rows[0].memory_id);
  assert.equal(result.entry.memory.id, rows[0].memory_id);
  assert.match(result.entry.memory.imageUrl, /signed\.invalid/);
  assert.equal(result.entry.memory.thumbnailUrl, undefined);
  assert.deepEqual(signedPathCalls, [[rows[0].memory.image_path]]);
});

test("shared group names are trimmed and constrained", () => {
  assert.equal(normalizeSharedAlbumName(" 家族の思い出 "), "家族の思い出");
  assert.throws(() => normalizeSharedAlbumName(" "), /入力/);
  assert.throws(() => normalizeSharedAlbumName("あ".repeat(61)), /60文字/);
});

test("shared group rename updates the existing name column", async () => {
  const filters = [];
  let updatePayload = null;
  const client = {
    from(table) {
      assert.equal(table, "shared_albums");
      return {
        update(payload) { updatePayload = payload; return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        select(columns) {
          assert.equal(columns, "id, owner_id, name, created_at, updated_at");
          return this;
        },
        async maybeSingle() {
          return {
            data: {
              id: ALBUM_ID,
              owner_id: OWNER_ID,
              name: updatePayload.name,
              created_at: "2026-09-01T00:00:00Z",
              updated_at: "2026-09-07T00:00:00Z",
            },
            error: null,
          };
        },
      };
    },
  };

  const album = await renameSharedAlbum(client, ALBUM_ID, " 新しいグループ名 ");
  assert.deepEqual(updatePayload, { name: "新しいグループ名" });
  assert.deepEqual(filters, [["id", ALBUM_ID]]);
  assert.equal(album.name, "新しいグループ名");
});

test("shared album members keep the group owner first", async () => {
  const client = {
    async rpc(name, args) {
      assert.equal(name, "list_shared_album_members");
      assert.deepEqual(args, { target_album_id: ALBUM_ID });
      return {
        data: [
          { user_id: "30000000-0000-4000-8000-000000000003", display_name: "メンバー", role: "member", joined_at: "2026-09-01T00:00:00Z" },
          { user_id: OWNER_ID, display_name: "リーダー", role: "owner", joined_at: "2026-09-02T00:00:00Z" },
        ],
        error: null,
      };
    },
  };
  const members = await listSharedAlbumMembers(client, ALBUM_ID);
  assert.deepEqual(members.map((member) => member.displayName), ["リーダー", "メンバー"]);
});

test("membership migration exposes only hardened atomic membership RPCs", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260905040000_manage_shared_album_membership.sql", import.meta.url), "utf8");
  for (const name of ["leave_shared_album", "remove_shared_album_member"]) {
    assert.match(sql, new RegExp(`function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
  assert.match(sql, /shared album owner cannot leave/);
  assert.match(sql, /require_current_shared_album_membership[\s\S]*for key share/);
  assert.match(sql, /delete from public\.shared_album_members[\s\S]*delete from public\.shared_album_memories[\s\S]*added_by = target_user_id/);
});

test("shared group pages expose the required navigation and read-only detail", () => {
  const nav = readFileSync(new URL("../components/bottom-nav.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/app-header.tsx", import.meta.url), "utf8");
  const list = readFileSync(new URL("../app/shared-groups/page.tsx", import.meta.url), "utf8");
  const createButton = readFileSync(new URL("../components/shared-group-create-button.tsx", import.meta.url), "utf8");
  const addButton = readFileSync(new URL("../components/shared-add-button.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../components/shared-group-detail.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../components/shared-group-controls.tsx", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../components/shared-group-dialog.tsx", import.meta.url), "utf8");
  const backLink = readFileSync(new URL("../components/app-back-link.tsx", import.meta.url), "utf8");
  const memory = readFileSync(new URL("../components/shared-memory-detail.tsx", import.meta.url), "utf8");
  assert.match(nav, /href: "\/shared-groups", label: "共有"/);
  assert.doesNotMatch(nav, /href: "\/more", label: "その他"/);
  assert.match(header, /href="\/more"/);
  assert.match(list, /届いている招待/);
  assert.match(list, /参加中のグループ/);
  assert.doesNotMatch(list, /\{albums\.length\}件/);
  assert.match(list, /joined-groups-title[\s\S]*SharedGroupCreateButton/);
  assert.match(list, /getGroupProfiles/);
  assert.match(list, /membersByAlbumId/);
  assert.match(list, /aria-label=\{`メンバー:/);
  assert.match(createButton, /SharedAddButton/);
  assert.match(createButton, /label="グループを作成"/);
  assert.match(createButton, /aria-haspopup="dialog"/);
  assert.match(addButton, /aria-label=\{label\}/);
  assert.match(addButton, /<Plus size=\{17\}[\s\S]*aria-hidden="true"/);
  assert.match(addButton, /text-coral/);
  assert.match(controls, /name="memoryHandling" value="keep" defaultChecked/);
  assert.match(controls, /name="memoryHandling" value="remove"/);
  assert.match(controls, /type="email" name="email"/);
  assert.match(detail, /SharedGroupControls/);
  assert.match(controls, /<SharedGroupDialog[\s\S]*fullScreen/);
  assert.match(dialog, /shared-group-dialog--fullscreen/);
  assert.match(dialog, /aria-label="ひとつ前の画面へ戻る"[\s\S]*<ArrowLeft size=\{20\} strokeWidth=\{1\.8\}/);
  assert.match(backLink, /h-9 w-9[\s\S]*<ArrowLeft size=\{20\} strokeWidth=\{1\.8\}/);
  assert.match(detail, /<AppBackLink href="\/shared-groups" label="共有一覧へ戻る" \/>/);
  assert.match(memory, /<AppBackLink href=\{`\/shared-groups\/\$\{groupId\}`\}/);
  assert.doesNotMatch(memory, /READ ONLY|閲覧専用|所有者だけ/);
  assert.match(memory, /className="block h-auto w-full bg-paper object-contain"/);
  assert.doesNotMatch(memory, /aspect-\[4\/3\]|bg-black/);
  assert.doesNotMatch(memory, /MemoryDetailActions|album-settings|deleteMemory|updateMemory/);
});

test("shared group settings and thumbnails expose the compact presentation controls", () => {
  const list = readFileSync(new URL("../app/shared-groups/page.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../components/shared-group-detail.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../components/shared-group-controls.tsx", import.meta.url), "utf8");
  const createButton = readFileSync(new URL("../components/shared-group-create-button.tsx", import.meta.url), "utf8");
  const groupIcon = readFileSync(new URL("../components/shared-group-icon.tsx", import.meta.url), "utf8");
  const presentation = readFileSync(new URL("../components/shared-group-presentation.tsx", import.meta.url), "utf8");
  const gallery = readFileSync(new URL("../components/shared-memory-gallery.tsx", import.meta.url), "utf8");
  const sharedAlbums = readFileSync(new URL("../lib/supabase/shared-albums.ts", import.meta.url), "utf8");
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  const settingsButton = controls.match(
    /<button\s+type="button"\s+onClick=\{\(event\) => openSettings\(event\.currentTarget\)\}[\s\S]*?<\/button>/,
  )?.[0];
  assert.ok(settingsButton, "the group settings trigger should remain identifiable");
  assert.match(settingsButton, /aria-label="グループ設定"/);
  assert.match(settingsButton, /<Settings size=\{17\} \/>/);
  assert.doesNotMatch(settingsButton, />\s*設定\s*</, "the trigger must show only the gear");

  assert.match(controls, /aria-label="グループプロフィール"/);
  assert.match(controls, /size="profile"/);
  assert.match(controls, /aria-label="グループ画像を変更"/);
  assert.match(controls, /type="file" name="icon" accept=\{SHARED_GROUP_ICON_ACCEPT\}/);
  assert.match(controls, /await uploadIcon\(file\)/);
  assert.match(presentation, /method: "POST", body/);
  assert.doesNotMatch(controls, /fetch\(/);
  assert.match(controls, /action=\{submitAction\(renameSharedGroupAction\)\}/);
  assert.match(controls, /name="name"[\s\S]*aria-label="グループ名を編集"/);
  assert.match(controls, /aria-label="グループ名を確定"/);
  assert.match(sharedAlbums, /export async function renameSharedAlbum/);
  const membersPosition = controls.indexOf(">メンバー</h3>");
  const displayPosition = controls.indexOf(">表示設定</h3>");
  assert.ok(membersPosition > controls.indexOf("aria-label=\"グループプロフィール\""));
  assert.ok(displayPosition > membersPosition);
  assert.match(controls, /className=\{`border-t border-line pt-5 \$\{isOwner \? "" : "opacity-60"\}`\}/);
  assert.match(controls, /panel\.kind === "display" \? \(/);
  assert.match(controls, /fieldset disabled=\{busy \|\| !isOwner\}/);
  assert.doesNotMatch(presentation, /localStorage|sessionStorage/);
  assert.match(presentation, /await refreshGroup/);
  assert.match(presentation, /showCaption: false/);
  assert.match(presentation, /showDate: false/);
  assert.match(presentation, /quizMode: "random"/);
  assert.match(presentation, /balanceQuizContributors: false/);
  assert.doesNotMatch(sharedAlbums, /icon_path|show_caption|show_date|updateSharedAlbumSettings/);

  assert.match(controls, /const roundCheckbox = "[^"]*appearance-none[^"]*rounded-full[^"]*"/);
  assert.match(controls, /type="checkbox" name="showCaption" defaultChecked=\{presentation\.showCaption\} className=\{roundCheckbox\}/);
  assert.match(controls, /type="checkbox" name="showDate" defaultChecked=\{presentation\.showDate\} className=\{roundCheckbox\}/);
  assert.doesNotMatch(controls, /type="radio" name="show(?:Caption|Date)"/);
  assert.match(controls, /一言を表示/);
  assert.match(controls, /日付を表示/);
  assert.match(controls, /みんなでクイズ（ランダム）/);
  assert.match(controls, /みんなでクイズ（カスタム）/);
  assert.match(controls, /name="balanceQuizContributors"/);
  assert.match(controls, /投稿者ごとになるべく平等/);
  assert.match(controls, /"quizMonthCount", "いつか"/);
  assert.match(controls, /"quizPhotoToCaptionCount", "写真から一言"/);
  assert.match(controls, /"quizCaptionToPhotoCount", "一言から写真"/);
  assert.match(controls, /\[3, 5, 10\]\.map/);

  assert.match(groupIcon, /<Image[\s\S]*onError=\{\(\) => setFailedSource/);
  assert.match(groupIcon, /<UsersRound[\s\S]*aria-hidden="true"/);
  assert.match(list, /<SharedGroupIcon groupId=\{album\.id\} \/>/);
  assert.match(detail, /<SharedGroupIcon groupId=\{groupId\} size="large" \/>/);
  assert.match(detail, /\{members\.length\}人のメンバー/);
  assert.match(detail, /\{entries\.length\}枚の写真/);

  assert.match(list, /joined-groups-title[\s\S]*<SharedGroupCreateButton/);
  assert.match(createButton, /<SharedAddButton[\s\S]*label="グループを作成"/);
  assert.match(detail, /shared-memories-title[\s\S]*<SharedMemoryShareButton/);
  assert.match(detail, /section className="mt-7 border-t border-line pt-5" aria-labelledby="shared-memories-title"/);
  assert.doesNotMatch(detail, /shared-memories-title[\s\S]{0,180}rounded-2xl border border-line bg-paper/);
  assert.match(controls, /<SharedAddButton ref=\{triggerRef\} label="思い出を共有"/);
  assert.doesNotMatch(detail, /\{entries\.length\}件/);
  assert.match(globals, /\.shared-group-dialog--fullscreen \{[\s\S]*height: 100dvh;[\s\S]*overflow-y: auto;/);

  assert.match(detail, /<SharedMemoryGallery groupId=\{groupId\}/);
  assert.match(gallery, /const photoOnly = !presentation\.showCaption && !presentation\.showDate/);
  assert.match(gallery, /photoOnly \? "grid-cols-3 gap-2" : "grid-cols-2 gap-3"/);
  assert.match(gallery, /presentation\.showCaption \? <p[^>]*>\{entry\.memory\.caption\}<\/p> : null/);
  assert.match(gallery, /presentation\.showDate \? <p[^>]*>\{formatShortDate\(entry\.memory\.date\)\}<\/p> : null/);
  assert.match(gallery, /<div className="absolute right-1 top-1 z-20"><SharedMemoryMenu/);
});

test("shared members use profile icons, owner crowns, levels, and a read-only profile route", () => {
  const list = readFileSync(new URL("../app/shared-groups/page.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../components/shared-group-controls.tsx", import.meta.url), "utf8");
  const identity = readFileSync(new URL("../components/shared-member-identity.tsx", import.meta.url), "utf8");
  const profile = readFileSync(new URL("../components/shared-member-profile.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/shared-groups/[groupId]/members/[userId]/page.tsx", import.meta.url), "utf8");
  const quiz = readFileSync(new URL("../components/shared-quiz-room.tsx", import.meta.url), "utf8");

  assert.match(controls, /href=\{`\/shared-groups\/\$\{groupId\}\/members\/\$\{member\.userId\}`\}/);
  assert.match(controls, /<SharedMemberAvatar[\s\S]*isOwner=\{member\.role === "owner"\}/);
  assert.match(identity, /absolute -left-1 -top-1[\s\S]*<Crown size=\{11\}/);
  assert.match(identity, /Lv\.\{resolvedLevel\}/);
  assert.match(list, /<SharedMemberName/);
  assert.match(quiz, /<SharedMemberName/g);
  assert.match(route, /<AppBackLink href=\{`\/shared-groups\/\$\{groupId\}`\}/);
  assert.match(route, /getGroupProfiles\(client, groupId, userId\)/);
  assert.match(route, /client\.auth\.getUser\(\)/);
  assert.match(route, /if \(!member\) notFound\(\)/);
  assert.match(profile, /<ProfileLevelOverview levelProgress=\{levelProgress\}/);
  assert.match(profile, /<ProfileRecordGrid stats=\{stats\}/);
  assert.doesNotMatch(profile, /Camera|Pencil|setNickname|setAvatarFile/);
});

test("shared thumbnail URLs are reused until expiry and remain isolated per cache", async () => {
  const { client, signedPathCalls } = loaderHarness({ denySecondPath: false });
  const firstUserGroup = new Map();
  const first = await loadSharedAlbumMemoryEntries(client, ALBUM_ID, firstUserGroup);
  await loadSharedAlbumMemoryEntries(client, ALBUM_ID, firstUserGroup);
  assert.equal(signedPathCalls.length, 1, "valid URLs must not be regenerated");
  const [path, value] = firstUserGroup.entries().next().value;
  firstUserGroup.set(path, { ...value, expiresAt: 0 });
  await loadSharedAlbumMemoryEntries(client, ALBUM_ID, firstUserGroup);
  assert.deepEqual(signedPathCalls[1], [path], "renew only the expired path");
  await loadSharedAlbumMemoryEntries(client, ALBUM_ID, new Map());
  assert.equal(signedPathCalls.length, 3, "another scope cannot reuse the first scope's URLs");
  assert.ok(first.entries[0].memory.thumbnailUrl);
});
