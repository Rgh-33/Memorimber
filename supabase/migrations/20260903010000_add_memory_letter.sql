alter table public.memories
  add column if not exists letter text not null default '';

alter table public.memories
  drop constraint if exists memories_letter_length;

alter table public.memories
  add constraint memories_letter_length
  check (char_length(letter) <= 400);

comment on column public.memories.letter is
  'Optional longer note printed beneath the memory metadata';

grant insert (letter), update (letter) on table public.memories to authenticated;
