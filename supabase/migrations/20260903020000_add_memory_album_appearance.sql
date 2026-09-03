alter table public.memories
  add column if not exists album_appearance jsonb;

alter table public.memories
  drop constraint if exists memories_album_appearance_shape;

alter table public.memories
  add constraint memories_album_appearance_shape
  check (
    album_appearance is null
    or (
      jsonb_typeof(album_appearance) = 'object'
      and album_appearance = jsonb_build_object(
        'font', album_appearance ->> 'font',
        'layout', album_appearance ->> 'layout',
        'textColor', album_appearance ->> 'textColor',
        'background', album_appearance ->> 'background',
        'pattern', album_appearance ->> 'pattern',
        'orientation', album_appearance ->> 'orientation'
      )
      and album_appearance ->> 'font' in ('zen-kurenaido', 'gothic', 'mincho', 'rounded')
      and album_appearance ->> 'layout' in ('scrapbook', 'gallery', 'diary')
      and album_appearance ->> 'textColor' in ('cocoa', 'navy', 'rose', 'forest')
      and album_appearance ->> 'background' in ('cream', 'white', 'blush', 'mist')
      and album_appearance ->> 'pattern' in ('botanical', 'plain', 'dots', 'grid')
      and album_appearance ->> 'orientation' in ('portrait', 'landscape')
    )
  );

comment on column public.memories.album_appearance is
  'Complete per-memory album appearance. Null means the device-wide album defaults are used.';

grant insert (album_appearance), update (album_appearance) on table public.memories to authenticated;
