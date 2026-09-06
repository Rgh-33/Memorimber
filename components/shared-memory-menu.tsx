"use client";

import { Component, useActionState, useEffect, useRef, useState, type RefObject } from "react";
import { unstable_rethrow } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { SharedGroupDialog } from "@/components/shared-group-dialog";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { removeSharedMemoryAction } from "@/app/shared-groups/actions";

type MemoryMenuProps = { groupId: string; memoryId: string; caption: string };
type RemovalDialogProps = MemoryMenuProps & {
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
};

const cancelClassName = "rounded-xl border border-line px-4 py-3 text-xs font-semibold focus-visible:outline-coral disabled:opacity-45";

function RemoveSharedMemoryDialog({ groupId, memoryId, caption, onClose, returnFocusRef }: RemovalDialogProps) {
  const [result, formAction, pending] = useActionState(removeSharedMemoryAction, null);

  return (
    <SharedGroupDialog title="思い出の共有を解除" busy={pending} onClose={onClose} returnFocusRef={returnFocusRef}>
      <p className="mt-4 break-words text-sm leading-6">「{caption}」の共有を解除しますか？</p>
      <p className="mt-2 text-xs leading-6 text-ink/60">このグループから思い出が外れます。現在のメンバーが所有する元の思い出と写真は残ります。退会者の保持写真は、最後の共有先がなくなると削除されます。</p>
      <form action={formAction} aria-busy={pending} className="mt-5 grid grid-cols-2 gap-3">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="memoryId" value={memoryId} />
        {result ? <p role="alert" className="auth-notice auth-notice--error col-span-2">{result.error}</p> : null}
        <button type="button" onClick={onClose} disabled={pending} className={cancelClassName}>キャンセル</button>
        <SharedGroupSubmitButton disabled={pending} tone="danger" pendingLabel="解除中…">{result ? "もう一度試す" : "解除する"}</SharedGroupSubmitButton>
      </form>
    </SharedGroupDialog>
  );
}

// A rejected transport request stops useActionState's queue. Remount the form
// on retry, while letting Next.js handle successful server redirects itself.
class RemovalErrorBoundary extends Component<RemovalDialogProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(error: unknown) {
    unstable_rethrow(error);
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return <RemoveSharedMemoryDialog {...this.props} />;

    return (
      <SharedGroupDialog title="思い出の共有を解除" onClose={this.props.onClose} returnFocusRef={this.props.returnFocusRef}>
        <p role="alert" className="auth-notice auth-notice--error mt-4">通信状態を確認して、もう一度お試しください。</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={this.props.onClose} className={cancelClassName}>キャンセル</button>
          <button type="button" onClick={() => this.setState({ failed: false })} className={cancelClassName}>もう一度試す</button>
        </div>
      </SharedGroupDialog>
    );
  }
}

export function SharedMemoryMenu({ groupId, memoryId, caption }: MemoryMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const close = () => setConfirming(false);

  useEffect(() => {
    const details = detailsRef.current;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
  }, []);

  return (
    <>
      <details ref={detailsRef} className="shared-memory-menu relative shrink-0" onBlur={(event) => {
        // Safari may blur the summary without focusing the clicked button.
        // A null destination must not hide that button before its click fires.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          triggerRef.current?.focus();
        }
      }}>
        <summary ref={triggerRef} aria-label={`${caption}の操作`} className="group grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full focus-visible:outline-none">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-line/80 bg-ivory/90 text-ink/60 shadow-sm backdrop-blur-sm transition group-hover:bg-paper group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-coral">
            <Ellipsis size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        </summary>
        <div className="absolute right-1 top-10 z-20 w-36 origin-top-right rounded-xl border border-line bg-ivory p-1 shadow-card">
          <button type="button" onClick={() => {
            if (detailsRef.current) detailsRef.current.open = false;
            triggerRef.current?.focus();
            setConfirming(true);
          }} className="min-h-11 w-full rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-paper focus-visible:outline-coral">共有を解除</button>
        </div>
      </details>
      {confirming ? <RemovalErrorBoundary groupId={groupId} memoryId={memoryId} caption={caption} onClose={close} returnFocusRef={triggerRef} /> : null}
    </>
  );
}
