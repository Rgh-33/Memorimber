"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type Props = {
  title: string;
  subtitle?: string;
  busy?: boolean;
  fullScreen?: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

/** Shared native modal: focus containment, scroll locking and dismissal behavior. */
export function SharedGroupDialog({ title, subtitle, busy = false, fullScreen = false, onClose, returnFocusRef, children }: Props) {
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
      className={`shared-group-dialog bg-ivory text-ink ${fullScreen ? "shared-group-dialog--fullscreen" : "rounded-2xl border border-line p-5 shadow-card"}`}
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      }}
    >
      <div className={`shared-group-dialog-header flex items-start gap-2 ${fullScreen ? "px-5 py-3" : "justify-between"}`}>
        {fullScreen ? (
          <button type="button" onClick={dismiss} disabled={busy} aria-label="ひとつ前の画面へ戻る" className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-ivory text-ink transition hover:border-coral hover:bg-paper hover:text-coral disabled:opacity-45">
            <ArrowLeft size={20} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 py-2">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="break-words text-lg font-bold outline-none">{title}</h2>
          {subtitle ? <p className="mt-1 break-words text-xs text-ink/60">{subtitle}</p> : null}
        </div>
        {!fullScreen ? (
          <button type="button" onClick={dismiss} disabled={busy} aria-label={`${title}を閉じる`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-paper focus-visible:outline-coral disabled:opacity-45">
            <X size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className={fullScreen ? "shared-group-dialog-body px-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))]" : ""}>
        {children}
      </div>
    </dialog>
  );
}
