let activeLocks = 0;
let lockedBody: HTMLElement | null = null;
let originalOverflow = "";

/**
 * Lock document scrolling until every current owner has released its lock.
 * Dialog-to-animation transitions can briefly mount two owners at once, so a
 * snapshot-and-restore in each component is not safe.
 */
export function acquireBodyScrollLock() {
  if (typeof document === "undefined") return () => undefined;

  if (activeLocks === 0) {
    lockedBody = document.body;
    originalOverflow = lockedBody.style.overflow;
    lockedBody.style.overflow = "hidden";
  }
  activeLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);

    if (activeLocks === 0) {
      if (lockedBody) lockedBody.style.overflow = originalOverflow;
      lockedBody = null;
      originalOverflow = "";
    }
  };
}
