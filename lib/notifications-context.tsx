"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUnreadInvitationNotificationCount } from "@/lib/supabase/shared-album-invitations";

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const requestId = useRef(0);

  const refreshUnreadCount = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!isSupabaseConfigured()) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadInvitationNotificationCount(createClient());
      if (requestId.current === currentRequest) setUnreadCount(count);
    } catch {
      if (requestId.current === currentRequest) setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
  }, [pathname, refreshUnreadCount]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used within NotificationsProvider");
  return value;
}
