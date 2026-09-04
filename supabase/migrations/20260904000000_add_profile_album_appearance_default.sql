alter table public.profiles
  add column if not exists album_appearance_default jsonb;

alter table public.profiles
  drop constraint if exists profiles_album_appearance_default_shape;

alter table public.profiles
  add constraint profiles_album_appearance_default_shape
  check (
    album_appearance_default is null
    or (
      jsonb_typeof(album_appearance_default) = 'object'
      and album_appearance_default = jsonb_build_object(
        'font', album_appearance_default ->> 'font',
        'layout', album_appearance_default ->> 'layout',
        'textColor', album_appearance_default ->> 'textColor',
        'background', album_appearance_default ->> 'background',
        'pattern', album_appearance_default ->> 'pattern',
        'orientation', album_appearance_default ->> 'orientation'
      )
      and coalesce(album_appearance_default ->> 'font' in ('zen-kurenaido', 'gothic', 'mincho', 'rounded'), false)
      and coalesce(album_appearance_default ->> 'layout' in ('scrapbook', 'gallery', 'diary'), false)
      and coalesce(album_appearance_default ->> 'textColor' in ('cocoa', 'navy', 'rose', 'forest'), false)
      and coalesce(album_appearance_default ->> 'background' in ('cream', 'white', 'blush', 'mist'), false)
      and coalesce(album_appearance_default ->> 'pattern' in ('botanical', 'plain', 'dots', 'grid'), false)
      and coalesce(album_appearance_default ->> 'orientation' in ('portrait', 'landscape'), false)
    )
  );

comment on column public.profiles.album_appearance_default is
  'Complete account-wide album appearance. Null means the application defaults are used.';
