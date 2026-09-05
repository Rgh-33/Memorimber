-- INSERT ... RETURNING checks SELECT policies before the AFTER INSERT trigger
-- adds the owner's membership. Allow the owner directly so creation can return
-- the new album while other users still need a formal membership to read it.
alter policy "Members can view shared albums"
  on public.shared_albums
  using (
    owner_id = (select auth.uid())
    or (select private.is_shared_album_member(id))
  );
