-- A fruit gets exactly one one-percent golden draw when it first ripens. The
-- result lives with the fruit so refreshes and later uploads cannot change it.
alter table public.memory_fruits
  add column is_golden boolean not null default false;

alter table public.memory_fruits
  add constraint memory_fruits_golden_only_when_ripe check (
    not is_golden or ripened_at is not null
  );

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
