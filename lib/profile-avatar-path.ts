/** Restrict avatar downloads to the existing upload format for this user.
 * profiles.avatar_url can contain user-controlled metadata. */
export function isOwnedProfileAvatarPath(userId: string, path: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  return new RegExp(`^${userId}/avatar-[0-9a-f-]{36}\\.(jpg|png|webp)$`, "i").test(path);
}
