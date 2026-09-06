"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { SharedGroupDialog } from "@/components/shared-group-dialog";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { removeSharedMemoryAction } from "@/app/shared-groups/actions";

export function SharedMemoryMenu({ groupId, memoryId, caption }: { groupId: string; memoryId: string; caption: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const close = () => {
    if (pendingRef.current) return;
    setConfirming(false);
  };

  return (
    <>
      <details ref={detailsRef} className="shared-memory-menu relative shrink-0" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          triggerRef.current?.focus();
        }
      }}>
        <summary ref={triggerRef} aria-label={`${caption}の操作`} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-line text-ink/60 hover:bg-ivory focus-visible:outline-coral"><Ellipsis size={20} aria-hidden="true" /></summary>
        <div className="absolute bottom-11 right-0 z-20 w-36 rounded-xl border border-line bg-ivory p-1 shadow-card">
          <button type="button" onClick={() => {
            if (detailsRef.current) detailsRef.current.open = false;
            triggerRef.current?.focus();
            setError(null);
            setConfirming(true);
          }} className="min-h-11 w-full rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-paper focus-visible:outline-coral">共有を解除</button>
        </div>
      </details>
      {confirming ? <SharedGroupDialog title="思い出の共有を解除" busy={busy} onClose={close} returnFocusRef={triggerRef}>
        <p className="mt-4 break-words text-sm leading-6">「{caption}」の共有を解除しますか？</p>
        <p className="mt-2 text-xs leading-6 text-ink/60">このグループから思い出が外れます。現在のメンバーが所有する元の思い出と写真は残ります。退会者の保持写真は、最後の共有先がなくなると削除されます。</p>
        <form action={async (formData) => {
          if (pendingRef.current) return;
          pendingRef.current = true;
          setBusy(true);
          setError(null);
          try {
            const result = await removeSharedMemoryAction(formData);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setConfirming(false);
            router.replace(`/shared-groups/${groupId}?${new URLSearchParams({ success: "共有を解除しました。" })}`, { scroll: false });
            router.refresh();
          } catch {
            setError("通信状態を確認して、もう一度お試しください。");
          } finally {
            pendingRef.current = false;
            setBusy(false);
          }
        }} aria-busy={busy} className="mt-5 grid grid-cols-2 gap-3">
          <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="memoryId" value={memoryId} />
          {error ? <p role="alert" className="auth-notice auth-notice--error col-span-2">{error}</p> : null}
          <button type="button" onClick={close} disabled={busy} className="rounded-xl border border-line px-4 py-3 text-xs font-semibold focus-visible:outline-coral disabled:opacity-45">キャンセル</button>
          <SharedGroupSubmitButton disabled={busy} tone="danger" pendingLabel="解除中…">{error ? "もう一度試す" : "解除する"}</SharedGroupSubmitButton>
        </form>
      </SharedGroupDialog> : null}
    </>
  );
}
