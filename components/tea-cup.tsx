import Image from "next/image";
import { type CSSProperties } from "react";
import { getTeaCupGeometry } from "@/lib/tea-cup-geometry";
import { getPearlAppearance, MAX_VISIBLE_PEARLS } from "@/lib/tea-pearl-layout";
import { TeaWordmark } from "./tea-wordmark";

export function TeaCup({ remaining, pearls, enteringIds = [], sipping = false, mini = false }: {
  remaining: number; pearls: string[]; enteringIds?: string[]; sipping?: boolean; mini?: boolean; decorative?: boolean;
}) {
  // Keep the oldest pearl and the latest additions visible, while
  // retaining the full backlog in state (never drop unanswered quizzes).
  const visiblePearls = pearls.length > MAX_VISIBLE_PEARLS ? [pearls[0], ...pearls.slice(-(MAX_VISIBLE_PEARLS - 1))] : pearls;
  const geometry = getTeaCupGeometry(remaining, visiblePearls.length);
  const style = {
    "--tea-fill-top": `${geometry.top}%`,
    "--tea-surface-width": `${geometry.width}%`,
    "--tea-surface-depth": `${geometry.surfaceDepth}%`,
    "--tea-ice-top": `${geometry.iceTop}%`,
    "--tea-ice-width": `${geometry.iceWidth}%`,
    "--tea-ice-waterline": `${geometry.iceWaterline}%`,
  } as CSSProperties;
  return (
    <span className={`tea-cup ${mini ? "tea-cup--mini" : ""} ${sipping ? "tea-cup--sipping" : ""}`} style={style} data-empty={geometry.level === 0 || undefined} data-full={geometry.level === 1 || undefined} aria-hidden="true">
      <span className="tea-cup-shadow" />
      <span className="tea-empty-photo">
        <Image src="/images/memory-tea-plastic-empty.png" alt="" width={1024} height={1536} sizes={mini ? "170px" : "370px"} priority={!mini} className="tea-photo tea-photo--empty" />
      </span>
      <span className="tea-cup-top">
        <Image src="/images/memory-tea-plastic-full.png" alt="" width={1024} height={1536} sizes={mini ? "170px" : "370px"} className="tea-photo" />
      </span>
      <span className="tea-liquid-photo">
        <Image src="/images/memory-tea-plastic-full.png" alt="" width={1024} height={1536} sizes={mini ? "170px" : "370px"} priority={!mini} className="tea-photo" />
      </span>
      <span className="tea-meniscus" />
      <span className="tea-pearls">
        {visiblePearls.map((id, index) => {
          const pearl = getPearlAppearance(id, index);
          const pearlStyle = { left: `${pearl.x}%`, top: `${pearl.y}%`, width: `${pearl.size}%`, zIndex: pearl.depth, "--pearl-opacity": pearl.opacity, "--pearl-sprite-x": `${pearl.spriteX}%`, "--pearl-sprite-y": `${pearl.spriteY}%`, "--pearl-delay": `${Math.min(index, 7) * 65}ms`, "--pearl-turn": `${pearl.turn}deg` } as CSSProperties;
          return <span key={id} className="tea-pearl-hit" data-entering={enteringIds.includes(id) || undefined} style={pearlStyle}><span className="tea-pearl" /></span>;
        })}
      </span>
      <span className="tea-ice">
        <Image src="/images/memory-tea-ice.png" alt="" width={2172} height={724} sizes={mini ? "70px" : "150px"} className="tea-photo tea-ice-submerged" />
        <Image src="/images/memory-tea-ice.png" alt="" width={2172} height={724} sizes={mini ? "70px" : "150px"} className="tea-photo tea-ice-emerged" />
      </span>
      <span className="tea-liquid-veil">
        <Image src="/images/memory-tea-plastic-full.png" alt="" width={1024} height={1536} sizes={mini ? "170px" : "370px"} className="tea-photo" />
      </span>
      <Image src="/images/memory-tea-plastic-empty.png" alt="" width={1024} height={1536} sizes={mini ? "170px" : "370px"} className="tea-photo tea-reflections" />
      <TeaWordmark />
      {sipping && <span className="tea-sipping-pearl tea-pearl" aria-hidden="true" />}
    </span>
  );
}
