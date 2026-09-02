"use client";

import Link from "next/link";
import { useId, type CSSProperties } from "react";
import type { MemoryTreeItem } from "@/lib/tree-data";
import { getTreeBranch, TREE_NODE_CAPACITY, TREE_PROPORTION } from "@/lib/tree-branches";
import { TreeArtDefs, TreeCanopy, TreeGround, TreeSeed, TreeSeedling, TreeWood } from "@/components/tree-art";
import { TreeFruit } from "@/components/tree-fruit";
import { fruitAppearanceFor, fruitHangAt, type FruitAppearance } from "@/lib/tree-fruit-layout";

function Blossom({ x, y, setting = false }: { x: number; y: number; setting?: boolean }) {
  if (setting) return <g transform={`translate(${x} ${y})`} className="konoha-flower konoha-flower--setting">
    <ellipse cy="3.5" rx="4.3" ry="5.6" className="konoha-fruit-ovary" />
    {[-48, -16, 18, 50].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d="M0 1 C-6 4 -7 11 -3 14 C1 11 2 6 0 1Z" />)}
    <path className="konoha-falling-blossom-petal" d="M8 8 C13 8 15 13 12 17 C8 16 6 12 8 8Z" />
    <circle cy="1" r="2.2" className="konoha-flower-center" />
  </g>;
  return <g transform={`translate(${x} ${y})`} className="konoha-flower konoha-flower--open">
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
    <ellipse className="konoha-magic-orbit konoha-magic-orbit--wide" rx="17" ry="5.5" />
    <g transform="rotate(67)"><ellipse className="konoha-magic-orbit konoha-magic-orbit--tall" rx="13" ry="4" /></g>
    <circle className="konoha-magic-core" r="3.2" />
    <path className="konoha-magic-burst" d="M0 -18V-10 M0 10V18 M-18 0H-10 M10 0H18 M-12 -12L-7 -7 M7 7L12 12 M12 -12L7 -7 M-7 7L-12 12" />
  </g>;
}

export function GrowthNode({ stage, fruitAppearance, fruitHang, eventKey, delay, newlyAdded, newlyFruited, newlyRipened }: {
  stage: number; fruitAppearance: FruitAppearance; fruitHang: { x: number; y: number }; eventKey: string; delay: number;
  newlyAdded: boolean; newlyFruited: boolean; newlyRipened: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const stemY = fruitHang.y + 8;
  return <g className="konoha-node-art" data-growth-stage={stage}>
    <defs>
      <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#a2b77a" /><stop offset=".48" stopColor="var(--leaf-color)" /><stop offset="1" stopColor="#3d593a" />
      </linearGradient>
    </defs>
    <path d="M0 14 Q0 3 -8 -5" fill="none" stroke="#859a6d" strokeWidth="1.3" strokeLinecap="round" />
    <g key={eventKey} className="konoha-stage-enter"
      style={{ "--growth-delay": `${delay}ms` } as CSSProperties}>
      <g className="konoha-growth-result">
        <g className="konoha-leaf">
          <path d="M-1 9 C-16 8 -24 -1 -28 -14 C-11 -12 3 -3 -1 9Z" fill={`url(#${uid}-leaf)`} stroke="#536a44" strokeWidth=".5" />
          <path d="M-2 8 Q-12 -5 -25 -12 M-9 0 L-17 0 M-14 -5 L-15 -9" fill="none" stroke="#f4f4d9" strokeOpacity=".48" strokeWidth=".7" />
        </g>
        {stage >= 2 && stage <= 5 && <path d={`M0 10 Q${fruitHang.x * .35} 9 ${fruitHang.x} ${stemY}`}
          fill="none" stroke="#859a6d" strokeWidth="1.2" strokeLinecap="round" />}
        {stage === 2 && <g transform={`translate(${fruitHang.x} ${stemY + 2})`} className="konoha-flower-bud konoha-flower-bud--small">
          <path d="M0 3 C-4 0 -3 -7 0 -9 C4 -7 5 0 0 3Z" />
          <path d="M-4 1 L0 5 4 1 L2 6 L-2 6Z" className="konoha-bud-sepal" />
        </g>}
        {stage === 3 && <g transform={`translate(${fruitHang.x} ${stemY + 1})`} className="konoha-flower-bud konoha-flower-bud--large">
          <path d="M0 5 C-8 1 -7 -11 0 -15 C8 -11 9 1 0 5Z" />
          <path d="M0 -12 C-2 -6 -2 0 0 4 M-5 -6 Q0 -2 5 -6" className="konoha-bud-vein" />
          <path d="M-6 2 L0 7 6 2 L3 8 L-3 8Z" className="konoha-bud-sepal" />
        </g>}
        {stage === 4 && <Blossom x={fruitHang.x} y={stemY} />}
        {stage === 5 && <Blossom x={fruitHang.x} y={stemY + 1} setting />}
        {stage >= 6 && <>
          <path d={`M0 8 Q${fruitHang.x * .3} 11 ${fruitHang.x} ${(stage === 7 ? 8 : 4) + fruitHang.y}`}
            fill="none" stroke="#859469" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M-3 13 L0 16 3 13" fill="#799766" transform={`translate(${fruitHang.x} ${fruitHang.y})`} />
          <g className={newlyRipened ? "konoha-just-ripe-pop" : undefined}>
            <TreeFruit uid={uid} appearance={fruitAppearance} mature={stage === 7} newlyFormed={newlyFruited}
              justRipened={newlyRipened} x={fruitHang.x} y={fruitHang.y} />
          </g>
        </>}
      </g>
      <GrowthMagic x={fruitHang.x} y={fruitHang.y + 18} golden={newlyAdded} />
    </g>
  </g>;
}

export function GrowingTree({ items, count, month }: { items: MemoryTreeItem[]; count: number; month: string }) {
  const uid = useId().replace(/:/g, "");
  const visible = items.filter(item => item.stage !== "harvested").slice(0, TREE_NODE_CAPACITY);
  const stage = Math.min(7, count);
  const scale = [0.18, 0.18, 0.32, 0.34, 0.52, 0.69, 0.85, 1][stage];
  const spread = [1, 1, 1, .5, .66, .8, .91, 1][stage];
  const heightSpread = [1, 1, 1, .62, .74, .86, .94, 1][stage];
  const monthIndex = Number(month.slice(5, 7));
  const mirrored = monthIndex % 2 === 0;
  const leafColor = ["#55724d", "#527366", "#79734a", "#586e54"][monthIndex % 4];
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
    <div className="konoha-tree-canvas" data-tree-growth={stage} data-month={month} style={{ "--leaf-color": leafColor } as CSSProperties}>
      <svg viewBox="0 0 380 420" className="konoha-tree-svg" aria-hidden="true">
        <defs><TreeArtDefs uid={uid} /></defs>
        <TreeGround uid={uid} stage={stage} front={false} />
        {stage === 1 && <TreeSeed uid={uid} />}
        {stage === 1 || stage === 2 ? <g key={`seedling-${count}`} className="konoha-stage-enter" style={{ "--growth-delay": "0ms" } as CSSProperties}>
          <g className="konoha-growth-result"><TreeSeedling uid={uid} stage={stage} /></g>
          <GrowthMagic x={190} y={stage === 1 ? 356 : 339} golden />
        </g> : <TreeSeedling uid={uid} stage={stage} />}
        <g className="konoha-tree-size" style={{ transform: `translate(190px, 383px) scale(${scale}) translate(-190px, -383px)`, opacity: stage >= 3 ? 1 : 0 }}>
          <g transform={`translate(190 383) scale(${TREE_PROPORTION.x} ${TREE_PROPORTION.y}) translate(-190 -383)`}>
          <g className="konoha-tree-wind">
            <g transform={mirrored ? "translate(380 0) scale(-1 1)" : undefined}>
              <g transform={growthTransform}>
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front={false} stage={stage} /></g>}
                <TreeWood uid={uid} stage={stage} />
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front stage={stage} /></g>}
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
                      <GrowthNode stage={item.growthStage ?? 1} fruitAppearance={fruitAppearanceFor(memoryId)} fruitHang={fruitHang}
                        eventKey={`${count}-${item.growthStage ?? 1}`} delay={Math.min(item.fruitSlot, 7) * 42}
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
        return <Link key={item.id} href={item.href} className="konoha-fruit-target" data-memory-id={item.id}
          style={{
            left: `${(190 + (slot.x - 190) * scale * TREE_PROPORTION.x + fruitHang.x) / 380 * 100}%`,
            top: `${(383 + (slot.y + 23 - 383) * scale * TREE_PROPORTION.y + fruitHang.y) / 420 * 100}%`,
          }}
          aria-label="育った実で思い出クイズに挑戦" />;
      })}
    </div>
  </>;
}
