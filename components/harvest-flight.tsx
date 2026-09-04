"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MemoryPetal } from "@/components/memory-petal";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type Phase = "writing" | "flying" | "fading" | "holding" | "returning";

function Pencil() {
  return <svg viewBox="0 0 110 24" aria-hidden="true">
    <path d="M3 12 L22 3 H99 Q105 3 105 8 V16 Q105 21 99 21 H22Z" fill="#d3b780" />
    <path d="M22 3 H94 V9 H22Z" fill="#748877" /><path d="M22 9 H94 V15 H22Z" fill="#a9b49a" />
    <path d="M22 15 H94 V21 H22Z" fill="#536b62" /><path d="M94 3 H99 V21 H94Z" fill="#b6b7a7" />
    <path d="M99 3 Q105 3 105 8 V16 Q105 21 99 21Z" fill="#cbb1a9" />
    <path d="M3 12 L11 8.2 V15.8Z" fill="#454b43" /><path d="M22 4 L19 10 22 15 20 19" fill="none" stroke="#eee0b4" />
  </svg>;
}

export function HarvestFlight({ word, saved, onFinish }: { word: string; saved: boolean; onFinish: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const surface = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("writing");
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const letters = [...word];
  const writingMs = Math.max(1400, 700 + letters.length * 100);
  const fadeMs = reduced ? 180 : 650;
  const revealMs = reduced ? 180 : 550;
  useBodyScrollLock();

  useEffect(() => {
    router.prefetch("/");
    surface.current?.focus({ preventScroll: true });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [router]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (phase === "writing") timer = setTimeout(() => setPhase(reduced ? "fading" : "flying"), reduced ? 80 : writingMs);
    if (phase === "flying") timer = setTimeout(() => setPhase("fading"), reduced ? 0 : 2400);
    if (phase === "fading") timer = setTimeout(() => {
      setPhase("holding");
      router.replace("/", { scroll: true });
    }, fadeMs);
    // Keep the solid curtain through navigation; no flash of an empty quiz or
    // an unhydrated tree, even if loading the home route takes longer.
    if (phase === "holding" && pathname === "/" && saved) timer = setTimeout(() => setPhase("returning"), reduced ? 100 : 520);
    if (phase === "returning") timer = setTimeout(onFinish, revealMs);
    return () => clearTimeout(timer);
  }, [phase, reduced, writingMs, fadeMs, revealMs, pathname, router, saved, onFinish]);

  const style = { "--write-ms": `${writingMs}ms`, "--fade-ms": `${fadeMs}ms`, "--reveal-ms": `${revealMs}ms`,
    "--ink-width": `${Math.min(78, letters.length * (letters.length > 8 ? 6 : 9.3))}%` } as CSSProperties;

  return <div ref={surface} className="konoha-harvest-flight konoha-petal-colors" data-phase={phase} data-reduced={reduced || undefined}
    style={style} role="dialog" aria-modal="true" aria-label={`「${word}」を花びらに書いて木へ戻ります`} tabIndex={-1}
    onKeyDown={event => {
      if (event.key === "Tab") event.preventDefault();
      if (event.key === "Escape" && (phase === "writing" || phase === "flying")) { event.preventDefault(); setPhase("fading"); }
    }}>
    <div className="konoha-harvest-sky" aria-hidden="true">
      <div className="konoha-sky-light" />
      <div className="konoha-sky-cloud konoha-sky-cloud--one" /><div className="konoha-sky-cloud konoha-sky-cloud--two" />
      <svg className="konoha-camera-canopy" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice">
        <g fill="currentColor">
          <path d="M-30 66 Q52 9 82 52 Q143 18 160 83 Q185 97 152 138 Q181 182 126 204 Q146 243 92 264 Q105 303 46 317 L-30 360Z" />
          <path d="M451 20 Q386 8 370 52 Q311 31 292 86 Q258 91 274 136 Q239 162 279 200 Q257 239 307 251 Q306 288 369 306 L451 375Z" />
        </g>
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d="M-20 457 Q49 285 138 110 M41 306 Q40 219 16 175 M79 232 Q136 220 163 182 M450 424 Q374 261 300 124 M394 307 Q412 231 409 199 M360 228 L292 206" strokeWidth="5" />
        </g>
      </svg>
      <div className="konoha-sky-mote konoha-sky-mote--one" /><div className="konoha-sky-mote konoha-sky-mote--two" />
    </div>
    <div className="konoha-flight-perspective" aria-hidden="true">
      <div className="konoha-flight-path"><div className="konoha-flight-flutter">
        <MemoryPetal className="konoha-flight-petal" />
        <div className="konoha-flight-writing" data-long={letters.length > 8 || undefined}>
          <span className="konoha-pencil-word">{letters.map((letter, index) => <span key={index} className="konoha-pencil-letter"
            style={{ animationDelay: `${300 + index * (writingMs - 650) / letters.length}ms` }}>{letter}</span>)}</span>
        </div>
        <div className="konoha-pencil-track"><div className="konoha-pencil"><Pencil /></div></div>
      </div></div>
    </div>
    <div className="konoha-harvest-curtain" aria-hidden="true" />
  </div>;
}
