"use client";

import { useEffect } from "react";
import { notificationSupport, registerNotificationWorker } from "@/lib/push-client";

export function PwaRegistration() {
  useEffect(() => {
    if (notificationSupport()) void registerNotificationWorker().catch(() => { /* Notification setup can retry; core app remains usable. */ });
  }, []);
  return null;
}
