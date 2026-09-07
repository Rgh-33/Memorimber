/** Only paths produced by the existing avatar upload API may be signed with a
 * privileged client. profiles.avatar_url can contain user-controlled metadata. */
export function isOwnedProfileAvatarPath(userId: string, path: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  return new RegExp(`^${userId}/avatar-[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(path);
}
