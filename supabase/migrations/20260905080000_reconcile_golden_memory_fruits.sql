-- Reconcile databases where the old 20260905000000 version was recorded by
-- another migration before the golden-fruit migration could add this column.
-- Keep this safe for databases where the golden-fruit schema already exists.
alter table public.memory_fruits
  add column if not exists is_golden boolean;

update public.memory_fruits
  set is_golden = false
  where is_golden is null;

alter table public.memory_fruits
  alter column is_golden set default false,
  alter column is_golden set not null;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conname = 'memory_fruits_golden_only_when_ripe'
        and constraint_record.conrelid = 'public.memory_fruits'::regclass
  ) then
    alter table public.memory_fruits
      add constraint memory_fruits_golden_only_when_ripe check (
        not is_golden or ripened_at is not null
      );
  end if;
end;
$$;

comment on column public.memory_fruits.is_golden is
  'Immutable result of the one-percent draw performed when ripened_at is first set';

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
  set
    ripened_at = monthly_ripening.ripened_at,
    is_golden = random() < 0.01
  from monthly_ripening
  where fruits.memory_id = monthly_ripening.memory_id
    and fruits.ripened_at is null
    and monthly_ripening.ripened_at is not null;

  return new;
end;
$$;

revoke all on function public.handle_new_memory_fruit() from public;

-- PostgREST normally observes DDL automatically; this makes the newly added
-- column visible immediately after deployment on already-running instances.
notify pgrst, 'reload schema';
