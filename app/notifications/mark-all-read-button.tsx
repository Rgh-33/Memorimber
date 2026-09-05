"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllNotificationsRead } from "./actions";
import { useNotifications } from "@/lib/notifications-context";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const markAllRead = () => {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refreshUnreadCount();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={markAllRead}
        disabled={disabled || isPending}
        className="rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-semibold text-coral transition hover:border-coral disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "更新中…" : "すべて既読"}
      </button>
      {error ? <p role="alert" className="max-w-48 text-right text-[10px] leading-4 text-red-600">{error}</p> : null}
    </div>
  );
}
