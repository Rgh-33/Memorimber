import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const thumbnailMigration = readFileSync(
  new URL("../supabase/migrations/20260905000000_add_memory_thumbnail_path.sql", import.meta.url),
  "utf8",
);
const storageMigration = readFileSync(
  new URL("../supabase/migrations/20260831000000_create_memories_and_storage.sql", import.meta.url),
  "utf8",
);

test("thumbnail_path is nullable and writable without changing image_path", () => {
  assert.match(
    thumbnailMigration,
    /add column if not exists thumbnail_path text\s*;/i,
  );
  assert.doesNotMatch(
    thumbnailMigration,
    /thumbnail_path text\s+(?:not null|default)\b/i,
  );
  assert.match(
    thumbnailMigration,
    /grant insert \(thumbnail_path\), update \(thumbnail_path\)[\s\S]*to authenticated/i,
  );
  assert.doesNotMatch(thumbnailMigration, /alter column image_path/i);
});

test("thumbnail_path must be a non-blank owner thumbnail path when present", () => {
  assert.match(
    thumbnailMigration,
    /memories_thumbnail_path_not_blank[\s\S]*thumbnail_path is null[\s\S]*btrim\(thumbnail_path\) <> ''/i,
  );
  assert.match(
    thumbnailMigration,
    /memories_thumbnail_path_owned_by_user[\s\S]*coalesce\([\s\S]*\(storage\.foldername\(thumbnail_path\)\)\[1\] = user_id::text,[\s\S]*false[\s\S]*\)/i,
  );
  assert.match(
    thumbnailMigration,
    /coalesce\([\s\S]*\(storage\.foldername\(thumbnail_path\)\)\[2\] = 'thumbnails',[\s\S]*false[\s\S]*\)/i,
  );
  assert.match(
    thumbnailMigration,
    /user_id::text \|\| '\/thumbnails\/\[\^\/\]\.\*'/i,
  );
});

test("existing private memory-images RLS covers nested thumbnail objects", () => {
  assert.match(
    storageMigration,
    /'memory-images',[\s\S]*false,[\s\S]*array\['image\/jpeg', 'image\/png', 'image\/webp'/i,
  );

  const policies = {
    select: "Users can view their own memory images",
    insert: "Users can upload their own memory images",
    update: "Users can update their own memory images",
    delete: "Users can delete their own memory images",
  };

  for (const [operation, name] of Object.entries(policies)) {
    const policyBlock = storageMigration.match(new RegExp(
      `create policy "${name}"[\\s\\S]*?;`,
      "i",
    ))?.[0];
    assert.ok(policyBlock, `missing ${operation} policy`);
    assert.match(policyBlock, new RegExp(`for ${operation}`, "i"));
    assert.match(policyBlock, /bucket_id = 'memory-images'/i);
    assert.match(
      policyBlock,
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i,
    );
    if (operation === "update") {
      assert.equal((policyBlock.match(/bucket_id = 'memory-images'/gi) ?? []).length, 2);
    }
  }
});
