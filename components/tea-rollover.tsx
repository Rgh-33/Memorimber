"use client";

import { useEffect, useRef } from "react";
import { useTea } from "@/lib/tea-context";
import { TeaCup } from "./tea-cup";

export function TeaRollover() {
  const { state, dismissRollover } = useTea();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const event = state.rollover;
  useEffect(() => {
    if (event && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [event]);
  if (!event) return null;
  const hadLeftover = event.remaining > 0;
  return (
    <dialog ref={dialogRef} className="tea-rollover" aria-labelledby="tea-rollover-title" onCancel={dismissRollover}>
      <p className="tea-eyebrow">A NEW MONTH, A FRESH CUP</p>
      <h2 id="tea-rollover-title">思い出は、次の一杯へ。</h2>
      <div className="tea-month-transfer" aria-hidden="true">
        <div className="tea-old-cup"><TeaCup remaining={event.remaining} pearls={[]} decorative mini /><span>{event.from.replace("-", " / ")}</span></div>
        <div className="tea-new-cup"><TeaCup remaining={1} pearls={state.pearls} enteringIds={state.pearls} decorative mini /><span>{event.to.replace("-", " / ")}</span></div>
        {state.pearls.slice(0, 12).map((id, index) => <span className="tea-transfer-pearl tea-pearl" style={{ animationDelay: `${.45 + index * .14}s` }} key={id} />)}
      </div>
      <p className="tea-rollover-story">{hadLeftover ? <>飲みきれなかったミルクティーとは、<br />ここで、さよなら。</> : <>最後のひと口まで、ありがとう。<br />新しい一杯を、用意しました。</>}</p>
      <p className="tea-rollover-detail">{event.carried > 0 ? <>でも、まだ味わっていない{event.carried}粒の思い出は、<br />順番もそのまま、新しいカップで待っています。</> : <>この月の言葉は、そのままに。<br />また、新しいひと粒を残していこう。</>}</p>
      <button type="button" className="tea-primary" autoFocus onClick={dismissRollover}>今月の一杯を、はじめる</button>
      <p className="tea-footnote">写真や思い出が消えることはありません。</p>
    </dialog>
  );
}
