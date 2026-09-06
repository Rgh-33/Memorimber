"use client";

import { useRef, useState, type RefObject } from "react";
import { Plus } from "lucide-react";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { SharedGroupDialog } from "@/components/shared-group-dialog";

type Props = {
  configured: boolean;
  createAction: (formData: FormData) => Promise<void>;
};

function CreateGroupDialog({ configured, createAction, onClose, returnFocusRef }: Props & { onClose: () => void; returnFocusRef: RefObject<HTMLButtonElement | null> }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <SharedGroupDialog title="新しいグループを作る" busy={submitting} onClose={onClose} returnFocusRef={returnFocusRef}>
      <form action={async (formData) => {
        setSubmitting(true);
        try {
          await createAction(formData);
        } finally {
          // The existing action redirects to the detail page or the list's error notice.
          onClose();
        }
      }} className="mt-4">
        <label className="block text-xs font-medium">
          グループ名
          <input data-dialog-autofocus name="name" required maxLength={60} disabled={!configured} placeholder="家族の思い出" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-base outline-none placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/10 disabled:opacity-50" />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-line bg-ivory px-4 py-3 text-xs font-semibold hover:border-coral focus-visible:outline-coral disabled:opacity-45">キャンセル</button>
          <SharedGroupSubmitButton disabled={!configured} pendingLabel="作成中…">グループを作成</SharedGroupSubmitButton>
        </div>
      </form>
    </SharedGroupDialog>
  );
}

export function SharedGroupCreateButton({ configured, createAction }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => {
    setOpen(false);
  };

  return (
    <>
      <div className="shared-group-create-fab">
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="accent-gradient flex h-14 items-center gap-3 whitespace-nowrap rounded-full px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral active:scale-95">
          <Plus size={24} strokeWidth={2} aria-hidden="true" />
          グループ作成
        </button>
      </div>
      {open ? <CreateGroupDialog configured={configured} createAction={createAction} onClose={closeDialog} returnFocusRef={triggerRef} /> : null}
    </>
  );
}
