begin;

select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '79000000-0000-4000-8000-000000000001',
  'golden-reconciliation@example.com',
  '{"display_name":"金の実確認"}'
);

insert into public.memories (id, user_id, image_path, caption, memory_date)
values (
  '79000000-0000-4000-8000-000000000011',
  '79000000-0000-4000-8000-000000000001',
  '79000000-0000-4000-8000-000000000001/golden-test.jpg',
  'golden reconciliation memory',
  '2026-09-05'
);

select results_eq(
  $$select is_nullable from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memory_fruits'
      and column_name = 'is_golden'$$,
  $$values ('NO'::text)$$,
  'is_golden exists and is not nullable'
);

select results_eq(
  $$select column_default from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memory_fruits'
      and column_name = 'is_golden'$$,
  $$values ('false'::text)$$,
  'is_golden defaults to false'
);

select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_constraint
    where conname = 'memory_fruits_golden_only_when_ripe'
      and conrelid = 'public.memory_fruits'::regclass$$,
  $$values (1::bigint)$$,
  'the golden-only-when-ripe constraint exists exactly once'
);

select throws_ok(
  $$update public.memory_fruits
    set is_golden = true
    where memory_id = '79000000-0000-4000-8000-000000000011'$$,
  '23514',
  null,
  'an unripened fruit cannot be golden'
);

select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_trigger
    where tgname = 'on_memory_created_create_and_ripen_fruits'
      and tgrelid = 'public.memories'::regclass
      and not tgisinternal$$,
  $$values (1::bigint)$$,
  'the existing memory trigger remains installed once'
);

select ok(
  pg_get_functiondef('public.handle_new_memory_fruit()'::regprocedure)
    ~ 'is_golden = random\(\) < 0.01',
  'the trigger function assigns gold only during ripening'
);

select * from finish();
rollback;
