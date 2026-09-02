"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import type { MemoryTreeItem } from "@/lib/tree-data";
import { getTreeBranch, getTreeCanvasMetrics, TREE_PROPORTION } from "@/lib/tree-branches";
import { TreeArtDefs, TreeCanopy, TreeGround, TreeSeed, TreeSeedling, TreeWood } from "@/components/tree-art";
import { TreeFruit } from "@/components/tree-fruit";
import { fruitAppearanceFor, fruitHangAt, type FruitAppearance } from "@/lib/tree-fruit-layout";
import type { Memory } from "@/lib/types";

function Blossom({ x, y, scale, setting = false }: { x: number; y: number; scale: number; setting?: boolean }) {
  if (setting) return <g transform={`translate(${x} ${y}) scale(${scale})`} className="konoha-flower konoha-flower--setting">
    <ellipse cy="3.5" rx="4.3" ry="5.6" className="konoha-fruit-ovary" />
    {[-48, -16, 18, 50].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d="M0 1 C-6 4 -7 11 -3 14 C1 11 2 6 0 1Z" />)}
    <path className="konoha-falling-blossom-petal" d="M8 8 C13 8 15 13 12 17 C8 16 6 12 8 8Z" />
    <circle cy="1" r="2.2" className="konoha-flower-center" />
  </g>;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} className="konoha-flower konoha-flower--open">
    {[0, 72, 144, 216, 288].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d="M0 0 C-8 -1 -12 -9 -7 -14 Q-2 -17 0 -10 C3 -17 11 -14 10 -7 Q8 -2 0 0Z" />)}
    <circle r="3.2" className="konoha-flower-center" />
    <g fill="#fff3a3"><circle cx="-2" cy="-1" r="1" /><circle cx="2" cy="-1" r=".9" /><circle cy="2" r=".7" /></g>
  </g>;
}

function GrowthMagic({ x, y, golden }: { x: number; y: number; golden: boolean }) {
  if (!golden) return <g className="konoha-growth-magic konoha-growth-magic--calm"
    transform={`translate(${x} ${y})`} aria-hidden="true">
    <circle className="konoha-calm-mote konoha-calm-mote--one" cx="-7" cy="3" r="1.35" />
    <circle className="konoha-calm-mote konoha-calm-mote--two" cx="5" cy="-5" r="1.05" />
    <circle className="konoha-calm-mote konoha-calm-mote--three" cx="8" cy="5" r=".85" />
    <path className="konoha-calm-glint" d="M0 -7V-2 M-2.5 -4.5H2.5" />
  </g>;
  return <g className="konoha-growth-magic konoha-growth-magic--golden"
    transform={`translate(${x} ${y})`} aria-hidden="true">
    <circle className="konoha-magic-aura" r="26" />
    <ellipse className="konoha-magic-orbit konoha-magic-orbit--wide" rx="29" ry="9" />
    <g transform="rotate(67)"><ellipse className="konoha-magic-orbit konoha-magic-orbit--tall" rx="23" ry="6.5" /></g>
    <g transform="rotate(-43)"><ellipse className="konoha-magic-orbit konoha-magic-orbit--cross" rx="26" ry="7.5" /></g>
    <circle className="konoha-magic-core" r="4.6" />
    <path className="konoha-magic-burst" d="M0 -38V-21 M0 21V38 M-38 0H-21 M21 0H38 M-27 -27L-15 -15 M15 15L27 27 M27 -27L15 -15 M-15 15L-27 27" />
    <g className="konoha-magic-scatter">
      <circle cx="-31" cy="-12" r="1.8" /><circle cx="28" cy="-17" r="1.35" />
      <circle cx="33" cy="14" r="1.65" /><circle cx="-25" cy="22" r="1.2" />
    </g>
  </g>;
}

function MemoryAbsorption({ x, y, imageUrl }: { x: number; y: number; imageUrl?: string }) {
  const uid = useId().replace(/:/g, "");
  if (!imageUrl) return null;
  return <g className="konoha-memory-absorb" transform={`translate(${x} ${y})`} aria-hidden="true">
    <defs><clipPath id={`${uid}-photo-clip`}><rect x="-23" y="-17" width="46" height="34" rx="4" /></clipPath></defs>
    <g className="konoha-memory-absorb-photo">
      <rect x="-24.5" y="-18.5" width="49" height="37" rx="5.5" className="konoha-memory-absorb-frame" />
      <image href={imageUrl} x="-23" y="-17" width="46" height="34" preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${uid}-photo-clip)`} />
      <rect x="-23" y="-17" width="46" height="34" rx="4" className="konoha-memory-absorb-glaze" />
    </g>
  </g>;
}

function GrowingSeedling({ uid, stage, count, imageUrl }: { uid: string; stage: 1 | 2; count: number; imageUrl?: string }) {
  const eventKey = `seedling-${count}-${stage}`;
  const [visibleStage, setVisibleStage] = useState<0 | 1 | 2>(stage === 1 ? 0 : 1);
  const [revealedEvent, setRevealedEvent] = useState<string | null>(null);
  const targetY = stage === 1 ? 356 : 339;

  useEffect(() => {
    if (visibleStage === stage) return;
    if (visibleStage > stage) {
      setVisibleStage(stage);
      setRevealedEvent(null);
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setVisibleStage(stage);
      setRevealedEvent(eventKey);
    }, reducedMotion ? 0 : 1_470);
    return () => window.clearTimeout(timer);
  }, [eventKey, stage, visibleStage]);

  return <g key={eventKey} className="konoha-seedling-growth" data-growth-stage={stage}
    data-visible-growth-stage={visibleStage} style={{ "--growth-delay": "720ms" } as CSSProperties}>
    {visibleStage > 0 && <g key={`${eventKey}-${visibleStage}`}
      className={`konoha-growth-result ${revealedEvent === eventKey ? "konoha-growth-result--reveal" : ""}`}>
      <TreeSeedling uid={uid} stage={visibleStage} />
    </g>}
    <GrowthMagic x={190} y={targetY} golden />
    <MemoryAbsorption x={190} y={targetY} imageUrl={imageUrl} />
  </g>;
}

export function GrowthNode({ stage, treeStage, fruitAppearance, fruitHang, eventKey, delay, newPhotoUrl, newlyAdded, newlyFruited, newlyRipened }: {
  stage: number; fruitAppearance: FruitAppearance; fruitHang: { x: number; y: number }; eventKey: string; delay: number;
  newPhotoUrl?: string;
  treeStage: number;
  newlyAdded: boolean; newlyFruited: boolean; newlyRipened: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const stemY = fruitHang.y + 8;
  const advancesThisUpload = newlyAdded || newlyFruited || newlyRipened || (stage >= 2 && stage <= 5);
  const previousStage = newlyAdded ? 0 : advancesThisUpload ? Math.max(1, stage - 1) : stage;
  const [visibleStage, setVisibleStage] = useState(previousStage);
  const [revealedEvent, setRevealedEvent] = useState<string | null>(null);
  const visibleTreeStage = visibleStage === stage ? treeStage : Math.max(0, treeStage - 1);
  const flowerScale = [0.56, 0.56, 0.56, 0.58, 0.68, 0.79, 0.9, 1][Math.max(0, Math.min(7, visibleTreeStage))];
  const sequence = newlyRipened ? "ripened" : newlyAdded ? "added" : advancesThisUpload ? "advanced" : "stable";
  const magicDelay = newlyRipened ? 1_430 : newlyAdded ? 720 : delay;
  const revealDelay = newlyRipened ? 1_900 : newlyAdded ? 1_470 : 260 + delay;

  useEffect(() => {
    if (visibleStage === stage) return;
    if (stage < visibleStage) {
      setVisibleStage(stage);
      setRevealedEvent(null);
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setVisibleStage(stage);
      setRevealedEvent(eventKey);
    }, reducedMotion ? 0 : revealDelay);
    return () => window.clearTimeout(timer);
  }, [eventKey, revealDelay, stage, visibleStage]);

  return <g className="konoha-node-art" data-growth-stage={stage} data-visible-growth-stage={visibleStage}
    data-growth-sequence={sequence} data-flower-scale={flowerScale}>
    <defs>
      <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#a2b77a" /><stop offset=".48" stopColor="var(--leaf-color)" /><stop offset="1" stopColor="#3d593a" />
      </linearGradient>
    </defs>
    <g key={eventKey} className="konoha-stage-enter"
      style={{ "--growth-delay": `${magicDelay}ms` } as CSSProperties}>
      {visibleStage > 0 && <g key={`${eventKey}-${visibleStage}`} className={`konoha-growth-result ${revealedEvent === eventKey ? "konoha-growth-result--reveal" : ""}`}>
        <path d="M0 14 Q0 3 -8 -5" fill="none" stroke="#859a6d" strokeWidth="1.3" strokeLinecap="round" />
        <g className="konoha-leaf">
          <path d="M-1 9 C-16 8 -24 -1 -28 -14 C-11 -12 3 -3 -1 9Z" fill={`url(#${uid}-leaf)`} stroke="#536a44" strokeWidth=".5" />
          <path d="M-2 8 Q-12 -5 -25 -12 M-9 0 L-17 0 M-14 -5 L-15 -9" fill="none" stroke="#f4f4d9" strokeOpacity=".48" strokeWidth=".7" />
        </g>
        {visibleStage >= 2 && visibleStage <= 5 && <path d={`M0 10 Q${fruitHang.x * .35} 9 ${fruitHang.x} ${stemY}`}
          fill="none" stroke="#859a6d" strokeWidth="1.2" strokeLinecap="round" />}
        {visibleStage === 2 && <g transform={`translate(${fruitHang.x} ${stemY + 2}) scale(${flowerScale})`} className="konoha-flower-bud konoha-flower-bud--small">
          <path d="M0 3 C-4 0 -3 -7 0 -9 C4 -7 5 0 0 3Z" />
          <path d="M-4 1 L0 5 4 1 L2 6 L-2 6Z" className="konoha-bud-sepal" />
        </g>}
        {visibleStage === 3 && <g transform={`translate(${fruitHang.x} ${stemY + 1}) scale(${flowerScale})`} className="konoha-flower-bud konoha-flower-bud--large">
          <path d="M0 5 C-8 1 -7 -11 0 -15 C8 -11 9 1 0 5Z" />
          <path d="M0 -12 C-2 -6 -2 0 0 4 M-5 -6 Q0 -2 5 -6" className="konoha-bud-vein" />
          <path d="M-6 2 L0 7 6 2 L3 8 L-3 8Z" className="konoha-bud-sepal" />
        </g>}
        {visibleStage === 4 && <Blossom x={fruitHang.x} y={stemY} scale={flowerScale} />}
        {visibleStage === 5 && <Blossom x={fruitHang.x} y={stemY + 1} scale={flowerScale} setting />}
        {visibleStage >= 6 && <>
          <path d={`M0 8 Q${fruitHang.x * .3} 11 ${fruitHang.x} ${(visibleStage === 7 ? 8 : 4) + fruitHang.y}`}
            fill="none" stroke="#859469" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M-3 13 L0 16 3 13" fill="#799766" transform={`translate(${fruitHang.x} ${fruitHang.y})`} />
          <g className={newlyRipened ? "konoha-just-ripe-pop" : undefined}>
            <TreeFruit uid={uid} appearance={fruitAppearance} mature={visibleStage === 7} newlyFormed={newlyFruited}
              justRipened={newlyRipened} x={fruitHang.x} y={fruitHang.y} />
          </g>
        </>}
      </g>}
      {advancesThisUpload && <GrowthMagic x={fruitHang.x} y={fruitHang.y + 18} golden={newlyAdded} />}
      {newlyAdded && <MemoryAbsorption x={fruitHang.x} y={fruitHang.y + 18} imageUrl={newPhotoUrl} />}
    </g>
  </g>;
}

export function GrowingTree({ items, memories, count, month, onFruitSelect }: {
  items: MemoryTreeItem[];
  memories: Memory[];
  count: number;
  month: string;
  onFruitSelect: (memoryId: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const visible = items.filter(item => item.stage !== "harvested");
  const stage = Math.min(7, count);
  const canvas = getTreeCanvasMetrics(count);
  const scale = [0.18, 0.18, 0.32, 0.34, 0.52, 0.69, 0.85, 1][stage];
  const spread = [1, 1, 1, .5, .66, .8, .91, 1][stage];
  const heightSpread = [1, 1, 1, .62, .74, .86, .94, 1][stage];
  const monthIndex = Number(month.slice(5, 7));
  const mirrored = monthIndex % 2 === 0;
  const leafColor = ["#55724d", "#527366", "#79734a", "#586e54"][monthIndex % 4];
  const imageById = new Map(memories.map((memory) => [memory.id, memory.imageUrl]));
  const latestItem = visible.find((item) => item.newlyAdded);
  const latestImageUrl = latestItem ? imageById.get(latestItem.memoryId ?? latestItem.id) : undefined;
  const position = (index: number) => {
    const branch = getTreeBranch(index, mirrored);
    return {
      ...branch,
      x: 190 + (branch.x - 190) * spread,
      y: 383 + (branch.y - 383) * heightSpread,
    };
  };
  const growthTransform = `translate(190 383) scale(${spread} ${heightSpread}) translate(-190 -383)`;
  return <>
    <div className="konoha-tree-canvas" data-tree-growth={stage} data-tree-photos={count} data-tree-extension-rows={canvas.extensionRows}
      data-month={month} style={{ "--leaf-color": leafColor, aspectRatio: `380 / ${canvas.height}` } as CSSProperties}>
      <svg viewBox={`0 ${canvas.minY} 380 ${canvas.height}`} className="konoha-tree-svg" aria-hidden="true">
        <defs><TreeArtDefs uid={uid} /></defs>
        <TreeGround uid={uid} stage={stage} front={false} />
        {stage === 1 && <TreeSeed uid={uid} />}
        {stage === 1 || stage === 2
          ? <GrowingSeedling uid={uid} stage={stage} count={count} imageUrl={latestImageUrl} />
          : <TreeSeedling uid={uid} stage={stage} />}
        <g className="konoha-tree-size" style={{ transform: `translate(190px, 383px) scale(${scale}) translate(-190px, -383px)`, opacity: stage >= 3 ? 1 : 0 }}>
          <g transform={`translate(190 383) scale(${TREE_PROPORTION.x} ${TREE_PROPORTION.y}) translate(-190 -383)`}>
          <g className="konoha-tree-wind">
            <g transform={mirrored ? "translate(380 0) scale(-1 1)" : undefined}>
              <g transform={growthTransform}>
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front={false} stage={stage} count={count} /></g>}
                <TreeWood uid={uid} stage={stage} count={count} />
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front stage={stage} count={count} /></g>}
              </g>
            </g>
            {visible.map((item) => {
              const slot = position(item.fruitSlot);
              const memoryId = item.memoryId ?? item.id;
              const fruitHang = fruitHangAt(item.fruitSlot, mirrored);
              return <g key={item.id} className="konoha-photo-node" data-slot-index={item.fruitSlot} data-memory-id={item.id}
                data-newly-added={item.newlyAdded || undefined} data-newly-fruited={item.newlyFruited || undefined}
                data-newly-ripened={item.newlyRipened || undefined}>
                <g className="konoha-branch-tip" transform={`translate(${slot.x} ${slot.y})`}>
                  <g className="konoha-node-size" style={{ transform: `translate(0px, 14px) scale(${1 / scale}) translate(0px, -14px)` }}>
                    <g className="konoha-node-wind" style={{ animationDelay: `${item.fruitSlot * -0.57}s` }}>
                      <GrowthNode stage={item.growthStage ?? 1} treeStage={stage} fruitAppearance={fruitAppearanceFor(memoryId)} fruitHang={fruitHang}
                        eventKey={`${count}-${item.growthStage ?? 1}`} delay={Math.min(item.fruitSlot, 7) * 42}
                        newPhotoUrl={item.newlyAdded ? imageById.get(memoryId) : undefined}
                        newlyAdded={item.newlyAdded === true} newlyFruited={item.newlyFruited === true}
                        newlyRipened={item.newlyRipened === true} />
                    </g>
                  </g>
                </g>
              </g>;
            })}
            {stage >= 5 && <g className="konoha-light-dust" fill="#f3e9bd" aria-hidden="true">
              <circle cx="153" cy="213" r="1.2" /><circle cx="228" cy="248" r=".9" /><circle cx="119" cy="162" r="1" /><circle cx="262" cy="114" r=".8" />
            </g>}
          </g>
          </g>
        </g>
        <TreeGround uid={uid} stage={stage} front />
      </svg>
      {visible.map((item) => {
        if (item.stage !== "quiz-ready") return null;
        const slot = position(item.fruitSlot);
        const fruitHang = fruitHangAt(item.fruitSlot, mirrored);
        const memoryId = item.memoryId ?? item.id;
        return <button key={item.id} type="button" onClick={() => onFruitSelect(memoryId)} className="konoha-fruit-target" data-memory-id={memoryId}
          style={{
            left: `${(190 + (slot.x - 190) * scale * TREE_PROPORTION.x + fruitHang.x) / 380 * 100}%`,
            top: `${(383 + (slot.y + 23 - 383) * scale * TREE_PROPORTION.y + fruitHang.y - canvas.minY) / canvas.height * 100}%`,
          }}
          aria-label="育った実で思い出クイズに挑戦" aria-haspopup="dialog" />;
      })}
    </div>
  </>;
}
