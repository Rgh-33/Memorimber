"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import type { MemoryTreeItem } from "@/lib/tree-data";

const SLOTS = [
  [113, 191], [257, 177], [174, 113], [286, 117], [72, 124], [222, 63],
  [129, 62], [310, 224], [66, 244], [248, 267], [147, 271], [209, 221],
] as const;

function Flower({ x, y, age = 0 }: { x: number; y: number; age?: number }) {
  if (age >= 2) return <g transform={`translate(${x} ${y})`} className={`konoha-flower konoha-flower--${age}`}>
    {[-28, 4, 32].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d={age === 2 ? "M0 0 C-7 2 -8 13 -3 16 Q1 12 2 5Z" : "M0 0 Q-7 5 -4 11 L-1 8 1 12 Q4 6 0 0Z"} />)}
    <path d="M-4 0 Q0 -4 4 0 L0 3Z" fill="#9b9772" />
  </g>;
  return <g transform={`translate(${x} ${y})`} className={`konoha-flower konoha-flower--${age}`}>
    {[0, 72, 144, 216, 288].map((angle) => <path key={angle} transform={`rotate(${angle})`}
      d="M0 0 C-10 -3 -10 -14 -3 -13 Q0 -10 3 -13 C10 -14 10 -3 0 0" />)}
    <circle r="2.8" fill={age ? "#b39062" : "#d3ad58"} />
    {!age && <g fill="#f7e7a7"><circle cx="-2" cy="-1" r="1" /><circle cx="2" cy="-1" r=".8" /></g>}
  </g>;
}

export function GrowthNode({ stage, harvested = false }: { stage: number; harvested?: boolean }) {
  return <g className="konoha-node-art" data-growth-stage={stage}>
    <path d="M0 14 Q0 3 -8 -5" fill="none" stroke="#859a6d" strokeWidth="1.3" strokeLinecap="round" />
    <g className="konoha-leaf">
      <path d="M-1 9 C-18 10 -27 0 -27 -12 C-9 -14 1 -4 -1 9Z" fill="var(--leaf-color)" />
      <path d="M-2 8 Q-11 -3 -24 -10" fill="none" stroke="#f4f4d9" strokeOpacity=".48" strokeWidth=".7" />
    </g>
    {!harvested && <g key={stage} className="konoha-stage-enter">
      {stage === 2 && <g><path d="M0 6 Q5 0 2 -7" fill="none" stroke="#839969" /><ellipse cx="2" cy="-6" rx="3.5" ry="5" fill="#dcb7b1" /><path d="M-1 -3 L2 0 5 -4" fill="#97ab7d" /></g>}
      {stage === 3 && <g><path d="M0 8 Q8 0 3 -6" fill="none" stroke="#839969" /><path d="M3 1 C-10 -3 -6 -17 3 -20 C13 -17 16 -4 3 1Z" fill="#e3b6b4" /><path d="M3 -17 Q0 -8 3 0 M-4 -6 L3 1 10 -6" fill="none" stroke="#b3868a" strokeWidth=".8" /></g>}
      {stage === 4 && <Flower x={2} y={-5} />}
      {stage >= 5 && <>
        <path d="M0 12 Q10 5 13 -9 M0 9 Q-6 0 -10 -8" fill="none" stroke="#859a6d" strokeWidth="1.1" />
        <Flower x={-10} y={stage >= 6 ? -10 : -6} age={stage - 4} />
        <Flower x={14} y={-9} />
      </>}
      {stage >= 6 && <g className={stage === 7 ? "konoha-ripe-fruit" : ""}>
        <path d="M0 8 L0 15" stroke="#859469" strokeWidth="1.2" />
        <ellipse cx="0" cy={stage === 7 ? 23 : 19} rx={stage === 7 ? 10 : 4.5} ry={stage === 7 ? 11 : 5}
          fill={stage === 7 ? "#dfab72" : "#acbc85"} stroke={stage === 7 ? "#c99764" : "#93a975"} strokeWidth=".6" />
        <path d={stage === 7 ? "M-4 18 Q-7 21 -5 25" : "M-1 17 L-2 19"} fill="none" stroke="#fff7dc" strokeWidth={stage === 7 ? 2.4 : 1.3} strokeLinecap="round" opacity=".65" />
        <path d="M-3 13 L0 16 3 13" fill="#799766" />
      </g>}
    </g>}
  </g>;
}

export function GrowingTree({ items, count, month }: { items: MemoryTreeItem[]; count: number; month: string }) {
  const [page, setPage] = useState(0);
  const uid = useId().replace(/:/g, "");
  const pages = Math.max(1, Math.ceil(items.length / SLOTS.length));
  const activePage = Math.min(page, pages - 1);
  const visible = items.slice(activePage * SLOTS.length, (activePage + 1) * SLOTS.length);
  const stage = Math.min(7, count);
  const scale = [0, 0.18, 0.32, 0.47, 0.61, 0.76, 0.89, 1][stage];
  const monthIndex = Number(month.slice(5, 7));
  const mirrored = monthIndex % 2 === 0;
  const leafColor = ["#8fa77d", "#91ac87", "#9fa87a", "#91a9a0"][monthIndex % 4];
  const position = (index: number) => {
    const [x, y] = SLOTS[index];
    return { x: mirrored ? 380 - x : x, y };
  };
  return <>
    <div className="konoha-tree-canvas" data-tree-growth={stage} data-month={month} style={{ "--leaf-color": leafColor } as CSSProperties}>
      <svg viewBox="0 0 380 420" className="konoha-tree-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}-bark`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#b5a48a" /><stop offset=".55" stopColor="#9c8c76" /><stop offset="1" stopColor="#c1b398" /></linearGradient>
          <radialGradient id={`${uid}-ground`}><stop stopColor="#a2ac8e" stopOpacity=".17" /><stop offset="1" stopColor="#a2ac8e" stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="190" cy="390" rx={38 + stage * 9} ry="12" fill={`url(#${uid}-ground)`} />
        {count === 0 ? <path d="M180 387 Q190 383 200 387" fill="none" stroke="#b3ae97" strokeWidth="1.6" strokeLinecap="round" /> :
          <g className="konoha-tree-size" style={{ transform: `translate(190px, 383px) scale(${scale}) translate(-190px, -383px)` }}>
            <g className="konoha-tree-wind">
              <path d="M180 384 C189 337 181 306 189 273 C198 234 187 181 198 142 Q197 205 201 249 C197 303 200 348 202 384 Q192 380 180 384Z" fill={`url(#${uid}-bark)`} />
              <path d="M190 376 Q188 335 193 290" fill="none" stroke="#e4dcc5" strokeOpacity=".4" strokeWidth="1.1" />
              {visible.map((item, index) => {
                const slot = position(index);
                const forkY = Math.min(330, slot.y + 95);
                return <g key={item.id}>
                  <path d={`M194 ${forkY} C${slot.x > 190 ? 226 : 156} ${forkY - 33} ${slot.x + (slot.x > 190 ? -15 : 15)} ${slot.y + 54} ${slot.x} ${slot.y + 8}`}
                    fill="none" stroke="#ad9e85" strokeWidth={2.2 + (slot.y / 130)} strokeLinecap="round" />
                  <path d={`M${slot.x} ${slot.y + 8} q${slot.x > 190 ? 9 : -9} -10 ${slot.x > 190 ? 15 : -15} -12`} fill="none" stroke="#b4a58c" strokeWidth="1.1" strokeLinecap="round" />
                  <g transform={`translate(${slot.x} ${slot.y})`}>
                    <g className="konoha-node-wind" style={{ animationDelay: `${index * -0.57}s` }}>
                      <GrowthNode stage={item.growthStage ?? 1} harvested={item.stage === "harvested"} />
                    </g>
                  </g>
                </g>;
              })}
            </g>
          </g>}
      </svg>
      {visible.map((item, index) => {
        if (item.stage !== "quiz-ready") return null;
        const slot = position(index);
        return <Link key={item.id} href={item.href} className="konoha-fruit-target" data-memory-id={item.id}
          style={{ left: `${(190 + (slot.x - 190) * scale) / 380 * 100}%`, top: `${(383 + (slot.y + 14 - 383) * scale) / 420 * 100}%` }}
          aria-label="育った実で思い出クイズに挑戦" />;
      })}
    </div>
    {pages > 1 && <div className="konoha-tree-pages" aria-label="木の枝の切り替え">
      <button type="button" disabled={activePage === 0} onClick={() => setPage(activePage - 1)} aria-label="前の枝"><ChevronLeft size={16} /></button>
      <span>{activePage + 1} / {pages}</span>
      <button type="button" disabled={activePage === pages - 1} onClick={() => setPage(activePage + 1)} aria-label="次の枝"><ChevronRight size={16} /></button>
    </div>}
  </>;
}
