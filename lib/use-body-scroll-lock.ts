"use client";

import { useEffect } from "react";
import { acquireBodyScrollLock } from "./body-scroll-lock";

export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return acquireBodyScrollLock();
  }, [enabled]);
}
