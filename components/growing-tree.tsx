"use client";

import Link from "next/link";
import { useId, type CSSProperties } from "react";
import type { MemoryTreeItem } from "@/lib/tree-data";
import { getTreeBranch, TREE_NODE_CAPACITY, TREE_PROPORTION } from "@/lib/tree-branches";
import { TreeArtDefs, TreeCanopy, TreeSeedling, TreeWood } from "@/components/tree-art";
import { TreeFruit } from "@/components/tree-fruit";
import { fruitAppearanceFor, fruitHangAt, type FruitAppearance } from "@/lib/tree-fruit-layout";

function Flower({ x, y, age = 0 }: { x: number; y: number; age?: number }) {
  if (age >= 2) return <g transform={`translate(${x} ${y}) scale(.82)`} className={`konoha-flower konoha-flower--${age}`}>
    {[-28, 4, 32].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d={age === 2 ? "M0 0 C-7 2 -8 13 -3 16 Q1 12 2 5Z" : "M0 0 Q-7 5 -4 11 L-1 8 1 12 Q4 6 0 0Z"} />)}
    <path d="M-4 0 Q0 -4 4 0 L0 3Z" fill="#9b9772" />
  </g>;
  return <g transform={`translate(${x} ${y}) scale(.82)`} className={`konoha-flower konoha-flower--${age}`}>
    {[0, 72, 144, 216, 288].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d="M0 0 C-8 -1 -11 -9 -6 -13 Q-2 -15 0 -10 C3 -16 10 -13 9 -7 Q8 -2 0 0" />)}
    <circle r="2.8" fill={age ? "#b39062" : "#d3ad58"} />
    {!age && <g fill="#f7e7a7"><circle cx="-2" cy="-1" r="1" /><circle cx="2" cy="-1" r=".8" /></g>}
  </g>;
}

export function GrowthNode({ stage, fruitAppearance, fruitHang }: {
  stage: number; fruitAppearance: FruitAppearance; fruitHang: { x: number; y: number };
}) {
  const uid = useId().replace(/:/g, "");
  return <g className="konoha-node-art" data-growth-stage={stage}>
    <defs>
      <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#a2b77a" /><stop offset=".48" stopColor="var(--leaf-color)" /><stop offset="1" stopColor="#3d593a" />
      </linearGradient>
    </defs>
    <path d="M0 14 Q0 3 -8 -5" fill="none" stroke="#859a6d" strokeWidth="1.3" strokeLinecap="round" />
    <g className="konoha-leaf">
      <path d="M-1 9 C-16 8 -24 -1 -28 -14 C-11 -12 3 -3 -1 9Z" fill={`url(#${uid}-leaf)`} stroke="#536a44" strokeWidth=".5" />
      <path d="M-2 8 Q-12 -5 -25 -12 M-9 0 L-17 0 M-14 -5 L-15 -9" fill="none" stroke="#f4f4d9" strokeOpacity=".48" strokeWidth=".7" />
    </g>
    <g key={stage} className="konoha-stage-enter">
      {stage === 2 && <g><path d="M0 6 Q5 0 2 -7" fill="none" stroke="#839969" /><ellipse cx="2" cy="-6" rx="3.5" ry="5" fill="var(--konoha-petal-edge)" /><path d="M-1 -3 L2 0 5 -4" fill="#97ab7d" /></g>}
      {stage === 3 && <g><path d="M0 8 Q8 0 3 -6" fill="none" stroke="#839969" /><path d="M3 1 C-10 -3 -6 -17 3 -20 C13 -17 16 -4 3 1Z" fill="var(--konoha-petal-fill)" /><path d="M3 -17 Q0 -8 3 0 M-4 -6 L3 1 10 -6" fill="none" stroke="var(--konoha-petal-edge)" strokeWidth=".8" /></g>}
      {stage === 4 && <Flower x={2} y={-5} />}
      {stage === 5 && <>
        <path d="M0 12 Q10 5 13 -9 M0 9 Q-6 0 -10 -8" fill="none" stroke="#859a6d" strokeWidth="1.1" />
        <Flower x={-10} y={-6} age={1} />
        <Flower x={14} y={-9} />
      </>}
      {stage >= 6 && <>
        <path d={`M0 8 Q${fruitHang.x * .3} 11 ${fruitHang.x} ${(stage === 7 ? 8 : 4) + fruitHang.y}`}
          fill="none" stroke="#859469" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M-3 13 L0 16 3 13" fill="#799766" transform={`translate(${fruitHang.x} ${fruitHang.y})`} />
        <TreeFruit uid={uid} appearance={fruitAppearance} mature={stage === 7} x={fruitHang.x} y={fruitHang.y} />
      </>}
    </g>
  </g>;
}

export function GrowingTree({ items, count, month }: { items: MemoryTreeItem[]; count: number; month: string }) {
  const uid = useId().replace(/:/g, "");
  const visible = items.filter(item => item.stage !== "harvested").slice(0, TREE_NODE_CAPACITY);
  const stage = Math.min(7, count);
  const scale = [0.18, 0.18, 0.32, 0.34, 0.52, 0.69, 0.85, 1][stage];
  const spread = [1, 1, 1, .5, .66, .8, .91, 1][stage];
  const monthIndex = Number(month.slice(5, 7));
  const mirrored = monthIndex % 2 === 0;
  const leafColor = ["#55724d", "#527366", "#79734a", "#586e54"][monthIndex % 4];
  const position = (index: number) => {
    const branch = getTreeBranch(index, mirrored);
    return { ...branch, x: 190 + (branch.x - 190) * spread };
  };
  return <>
    <div className="konoha-tree-canvas" data-tree-growth={stage} data-month={month} style={{ "--leaf-color": leafColor } as CSSProperties}>
      <svg viewBox="0 0 380 420" className="konoha-tree-svg" aria-hidden="true">
        <defs><TreeArtDefs uid={uid} /></defs>
        <ellipse cx="190" cy="390" rx={stage <= 2 ? 24 + stage * 7 : 38 + stage * 10} ry="14" fill={`url(#${uid}-ground)`} />
        <path d="M180 387 Q190 383 200 387" fill="none" stroke="#b3ae97" strokeWidth="1.6" strokeLinecap="round" opacity={count === 0 ? 1 : 0} />
        <TreeSeedling uid={uid} stage={stage} />
        <g className="konoha-tree-size" style={{ transform: `translate(190px, 383px) scale(${scale}) translate(-190px, -383px)`, opacity: stage >= 3 ? 1 : 0 }}>
          <g transform={`translate(190 383) scale(${TREE_PROPORTION.x} ${TREE_PROPORTION.y}) translate(-190 -383)`}>
          <g className="konoha-tree-wind">
            <g transform={mirrored ? "translate(380 0) scale(-1 1)" : undefined}>
              <g transform={`translate(190 0) scale(${spread} 1) translate(-190 0)`}>
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front={false} stage={stage} /></g>}
                <TreeWood uid={uid} stage={stage} />
                {stage >= 3 && <g className="konoha-crown"><TreeCanopy uid={uid} front stage={stage} /></g>}
              </g>
            </g>
            {visible.map((item) => {
              const slot = position(item.fruitSlot);
              const memoryId = item.memoryId ?? item.id;
              const fruitHang = fruitHangAt(item.fruitSlot, mirrored);
              return <g key={item.id} className="konoha-photo-node" data-slot-index={item.fruitSlot} data-memory-id={item.id}>
                <g className="konoha-branch-tip" transform={`translate(${slot.x} ${slot.y})`}>
                  <g className="konoha-node-size" style={{ transform: `translate(0px, 14px) scale(${1 / scale}) translate(0px, -14px)` }}>
                    <g className="konoha-node-wind" style={{ animationDelay: `${item.fruitSlot * -0.57}s` }}>
                      <GrowthNode stage={item.growthStage ?? 1} fruitAppearance={fruitAppearanceFor(memoryId)} fruitHang={fruitHang} />
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
