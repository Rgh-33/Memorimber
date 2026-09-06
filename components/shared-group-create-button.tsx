"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type Props = {
  configured: boolean;
  createAction: (formData: FormData) => Promise<void>;
};

function CreateGroupDialog({ configured, createAction, onClose }: Props & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const closeDialog = () => {
    if (submitting) return;
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="shared-group-create-dialog rounded-2xl border border-line bg-paper p-5 text-ink shadow-card"
      aria-labelledby="create-group-title"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="create-group-title" className="text-sm font-semibold">新しいグループを作る</h2>
        <button type="button" onClick={closeDialog} disabled={submitting} aria-label="グループ作成を閉じる" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-ivory focus-visible:outline-coral disabled:opacity-45">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form action={async (formData) => {
        setSubmitting(true);
        try {
          await createAction(formData);
        } finally {
          // The existing action redirects to the detail page or the list's error notice.
          dialogRef.current?.close();
          onClose();
        }
      }} className="mt-4">
        <label className="block text-xs font-medium">
          グループ名
          <input ref={inputRef} name="name" required maxLength={60} disabled={!configured} placeholder="家族の思い出" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-base outline-none placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/10 disabled:opacity-50" />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={closeDialog} disabled={submitting} className="rounded-xl border border-line bg-ivory px-4 py-3 text-xs font-semibold hover:border-coral focus-visible:outline-coral disabled:opacity-45">キャンセル</button>
          <SharedGroupSubmitButton disabled={!configured} pendingLabel="作成中…">グループを作成</SharedGroupSubmitButton>
        </div>
      </form>
    </dialog>
  );
}

export function SharedGroupCreateButton({ configured, createAction }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(open);

  const closeDialog = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <div className="shared-group-create-fab">
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="accent-gradient flex h-14 items-center gap-3 whitespace-nowrap rounded-full px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral active:scale-95">
          <Plus size={24} strokeWidth={2} aria-hidden="true" />
          グループ作成
        </button>
      </div>
      {open ? <CreateGroupDialog configured={configured} createAction={createAction} onClose={closeDialog} /> : null}
    </>
  );
}
