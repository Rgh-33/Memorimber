"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type Props = {
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

/** Shared native modal: focus containment, scroll locking and dismissal behavior. */
export function SharedGroupDialog({ title, subtitle, busy = false, onClose, returnFocusRef, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useBodyScrollLock();

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = returnFocusRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [returnFocusRef]);

  useEffect(() => {
    const input = dialogRef.current?.querySelector<HTMLElement>("[data-dialog-autofocus]");
    (input ?? titleRef.current)?.focus();
  }, [title]);

  const dismiss = () => { if (!busy) onClose(); };

  return (
    <dialog
      ref={dialogRef}
      className="shared-group-dialog rounded-2xl border border-line bg-ivory p-5 text-ink shadow-card"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 py-2">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="break-words text-lg font-bold outline-none">{title}</h2>
          {subtitle ? <p className="mt-1 break-words text-xs text-ink/60">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={dismiss} disabled={busy} aria-label={`${title}を閉じる`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-paper focus-visible:outline-coral disabled:opacity-45">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
