-- Persist only the user-driven state of one fruit per memory. A monthly tree
-- remains a derived view of memories.created_at in Asia/Tokyo; no tree/month,
-- image, caption or owner data is duplicated here.
create table public.memory_fruits (
  memory_id uuid primary key references public.memories (id) on delete cascade,
  ripened_at timestamptz,
  harvested_at timestamptz,
  harvest_word text,
  word_assigned_at timestamptz,
  home_visible_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_fruits_harvest_word_valid check (
    harvest_word is null
    or (
      harvest_word = btrim(harvest_word)
      and char_length(harvest_word) between 1 and 12
    )
  ),
  constraint memory_fruits_harvest_fields_consistent check (
    (
      harvested_at is null
      and harvest_word is null
      and word_assigned_at is null
      and home_visible_until is null
    )
    or (
      harvested_at is not null
      and harvest_word is not null
      and word_assigned_at is not null
      and home_visible_until is not null
    )
  ),
  constraint memory_fruits_harvest_after_ripening check (
    harvested_at is null
    or (
      ripened_at is not null
      and harvested_at >= ripened_at
    )
  ),
  constraint memory_fruits_word_after_harvest check (
    word_assigned_at is null or word_assigned_at >= harvested_at
  ),
  constraint memory_fruits_visibility_after_word check (
    home_visible_until is null or home_visible_until > word_assigned_at
  ),
  constraint memory_fruits_updated_after_creation check (updated_at >= created_at)
);

comment on table public.memory_fruits is
  'Persistent ripening and harvest state for exactly one fruit per memory';
comment on column public.memory_fruits.memory_id is
  'Primary key and owner-indirect reference to public.memories';
comment on column public.memory_fruits.ripened_at is
  'First time the fruit became eligible for its harvest quiz';
comment on column public.memory_fruits.harvested_at is
  'Time harvest completed after the quiz and word submission';
comment on column public.memory_fruits.harvest_word is
  'Trimmed one-to-twelve-character word assigned at harvest';
comment on column public.memory_fruits.word_assigned_at is
  'First time the harvest word was assigned';
comment on column public.memory_fruits.home_visible_until is
  'Exclusive home-display deadline, the next month boundary in Asia/Tokyo';

-- Support the two state-oriented lookups without indexing uninteresting rows.
create index memory_fruits_home_visibility_idx
  on public.memory_fruits (home_visible_until, memory_id)
  where home_visible_until is not null;

create index memory_fruits_ready_to_harvest_idx
  on public.memory_fruits (ripened_at, memory_id)
  where ripened_at is not null and harvested_at is null;

-- Monthly trees use successful upload time rather than editable memory_date.
-- The UUID is a deterministic tie-breaker for equal timestamps.
create index memories_user_created_at_idx
  on public.memories (user_id, created_at, id);

alter table public.memory_fruits enable row level security;

create policy "Users can view their own memory fruits"
  on public.memory_fruits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memories
      where memories.id = memory_fruits.memory_id
        and memories.user_id = (select auth.uid())
    )
  );

-- Rows are created by the memory trigger, removed by the memory foreign key,
-- ripened internally, and harvested through the constrained function below.
revoke all on table public.memory_fruits from anon, authenticated;
grant select on table public.memory_fruits to authenticated;

create or replace function public.set_memory_fruit_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_memory_fruit_updated_at() from public;

create trigger on_memory_fruit_updated_set_updated_at
  before update on public.memory_fruits
  for each row execute function public.set_memory_fruit_updated_at();

-- A new upload creates its fruit and can ripen the oldest fruit that now has
-- seven later uploads in the same Asia/Tokyo calendar month. Re-evaluating the
-- month also handles explicitly supplied historical created_at values safely.
create or replace function public.handle_new_memory_fruit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.memory_fruits (memory_id)
  values (new.id)
  on conflict (memory_id) do nothing;

  with monthly_ripening as (
    select
      memories.id as memory_id,
      lead(memories.created_at, 7) over (
        order by memories.created_at, memories.id
      ) as ripened_at
    from public.memories
    where memories.user_id = new.user_id
      and memories.created_at >= (
        date_trunc('month', new.created_at at time zone 'Asia/Tokyo')
        at time zone 'Asia/Tokyo'
      )
      and memories.created_at < (
        (
          date_trunc('month', new.created_at at time zone 'Asia/Tokyo')
          + interval '1 month'
        ) at time zone 'Asia/Tokyo'
      )
  )
  update public.memory_fruits as fruits
  set ripened_at = monthly_ripening.ripened_at
  from monthly_ripening
  where fruits.memory_id = monthly_ripening.memory_id
    and fruits.ripened_at is null
    and monthly_ripening.ripened_at is not null;

  return new;
end;
$$;

revoke all on function public.handle_new_memory_fruit() from public;

create trigger on_memory_created_create_and_ripen_fruits
  after insert on public.memories
  for each row execute function public.handle_new_memory_fruit();

-- Populate one fruit for every memory that predates this migration.
insert into public.memory_fruits (memory_id)
select memories.id
from public.memories
on conflict (memory_id) do nothing;

-- Preserve the historical moment at which each existing fruit first met the
-- current seven-later-uploads rule, using the seventh later upload timestamp.
with historical_ripening as (
  select
    memories.id as memory_id,
    lead(memories.created_at, 7) over (
      partition by
        memories.user_id,
        date_trunc('month', memories.created_at at time zone 'Asia/Tokyo')
      order by memories.created_at, memories.id
    ) as ripened_at
  from public.memories
)
update public.memory_fruits as fruits
set ripened_at = historical_ripening.ripened_at
from historical_ripening
where fruits.memory_id = historical_ripening.memory_id
  and fruits.ripened_at is null
  and historical_ripening.ripened_at is not null;

-- Harvesting is the only authenticated mutation exposed for memory_fruits.
-- It generates all event timestamps and the home deadline inside one statement
-- so clients cannot leave a partially harvested row behind.
create or replace function public.complete_memory_harvest(
  p_memory_id uuid,
  p_word text
)
returns public.memory_fruits
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_word text := btrim(p_word);
  completed_at timestamptz := now();
  visible_until timestamptz;
  harvested_fruit public.memory_fruits;
begin
  if caller_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to harvest a memory fruit';
  end if;

  if normalized_word is null
    or char_length(normalized_word) not between 1 and 12 then
    raise exception using
      errcode = '22023',
      message = 'Harvest word must contain between 1 and 12 characters';
  end if;

  visible_until := (
    date_trunc('month', completed_at at time zone 'Asia/Tokyo')
    + interval '1 month'
  ) at time zone 'Asia/Tokyo';

  update public.memory_fruits as fruits
  set
    harvested_at = completed_at,
    harvest_word = normalized_word,
    word_assigned_at = completed_at,
    home_visible_until = visible_until
  from public.memories
  where fruits.memory_id = p_memory_id
    and memories.id = fruits.memory_id
    and memories.user_id = caller_id
    and fruits.ripened_at is not null
    and fruits.harvested_at is null
  returning fruits.* into harvested_fruit;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Memory fruit is unavailable for harvest';
  end if;

  return harvested_fruit;
end;
$$;

revoke all on function public.complete_memory_harvest(uuid, text) from public;
grant execute on function public.complete_memory_harvest(uuid, text) to authenticated;
