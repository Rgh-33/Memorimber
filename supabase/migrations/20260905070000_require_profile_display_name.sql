-- A profile is created by the Auth trigger before the user reaches onboarding,
-- so display_name remains nullable for that short-lived state. Once set, it
-- cannot be cleared. Names are intentionally not unique: invitations use the
-- account email address and group members may choose the same display name.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conname = 'profiles_display_name_format'
        and constraint_record.conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_display_name_format
      check (
        display_name is null
        or (
          display_name = btrim(display_name)
          and char_length(display_name) between 1 and 20
        )
      );
  end if;
end;
$$;

comment on column public.profiles.display_name is
  'Required display name after first-login onboarding. Duplicate names are allowed.';

create or replace function public.prevent_profile_display_name_clear()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.display_name is not null and new.display_name is null then
    raise exception 'display_name cannot be cleared after onboarding'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_display_name_clear() from public;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_trigger trigger_record
      where trigger_record.tgname = 'on_profile_updated_prevent_display_name_clear'
        and trigger_record.tgrelid = 'public.profiles'::regclass
        and not trigger_record.tgisinternal
  ) then
    create trigger on_profile_updated_prevent_display_name_clear
      before update of display_name on public.profiles
      for each row execute function public.prevent_profile_display_name_clear();
  end if;
end;
$$;
