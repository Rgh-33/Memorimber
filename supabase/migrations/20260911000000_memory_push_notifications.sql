-- Notifications only. Existing applied migrations remain unchanged.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Claim before sending: an uncertain network outcome must never be resent.
create table public.memory_notification_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_date date not null,
  notification_type text not null check (notification_type in ('harvest', 'anniversary')),
  candidate_id uuid,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  primary key (user_id, notification_date)
);
alter table public.memory_notification_deliveries enable row level security;
revoke all on public.memory_notification_deliveries from anon, authenticated;
grant all on public.memory_notification_deliveries to service_role;
