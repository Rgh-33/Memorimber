-- memories.created_at determines both the monthly tree and fruit ripening
-- order. Replace broad write privileges with column-level grants so an
-- authenticated client must use the database default on insert and cannot
-- change the timestamp later.
--
-- The existing posting flow remains supported: it inserts id, image_path,
-- caption, memory_date, people and tags, while user_id and timestamps continue
-- to come from database defaults. Normal memory editing keeps the four editable
-- metadata fields and image-path replacement available.
revoke insert, update on table public.memories from authenticated;

grant insert (
  id,
  image_path,
  caption,
  memory_date,
  people,
  tags
) on table public.memories to authenticated;

grant update (
  image_path,
  caption,
  memory_date,
  people,
  tags
) on table public.memories to authenticated;
