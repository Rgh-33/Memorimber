alter table public.push_subscriptions
  add column harvest_enabled boolean not null default true,
  add column anniversary_enabled boolean not null default true,
  add column weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (cardinality(weekdays) <= 7 and array_position(weekdays, null) is null
      and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]);

-- Keep the legacy user/day table to suppress same-day sends during rollout.
create table public.push_notification_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_date date not null,
  notification_type text not null check (notification_type in ('harvest', 'anniversary')),
  candidate_id uuid,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  primary key (subscription_id, notification_date)
);
create index push_notification_deliveries_user_id_idx on public.push_notification_deliveries(user_id);
alter table public.push_notification_deliveries enable row level security;
revoke all on public.push_notification_deliveries from anon, authenticated;
grant all on public.push_notification_deliveries to service_role;

-- Rate limit tests across all of a user's devices, including concurrent requests.
create table public.push_notification_test_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null
);
alter table public.push_notification_test_limits enable row level security;
revoke all on public.push_notification_test_limits from anon, authenticated;
grant all on public.push_notification_test_limits to service_role;

create function public.claim_push_notification_test(p_user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_requested_at timestamptz;
begin
  insert into public.push_notification_test_limits (user_id, requested_at)
    values (p_user_id, v_now)
  on conflict (user_id) do update set requested_at = excluded.requested_at
    where public.push_notification_test_limits.requested_at <= v_now - interval '60 seconds'
  returning requested_at into v_requested_at;
  if found then return 0; end if;
  select requested_at into v_requested_at
    from public.push_notification_test_limits where user_id = p_user_id;
  return greatest(1, ceil(extract(epoch from v_requested_at + interval '60 seconds' - v_now))::integer);
end;
$$;
revoke all on function public.claim_push_notification_test(uuid) from public, anon, authenticated;
grant execute on function public.claim_push_notification_test(uuid) to service_role;
