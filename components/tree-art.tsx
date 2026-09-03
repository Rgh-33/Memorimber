import { memo } from "react";
import { getTreeAddedFruitCenter, getTreeStructure, TREE_NODE_CAPACITY } from "@/lib/tree-branches";

type CanopyClump = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  birth: number;
  front: boolean;
  tilt: number;
};

// Rounded, overlapping masses build the same calm storybook silhouette as the
// reference while leaving every existing branch tip in its original position.
const CANOPY_CLUMPS: readonly CanopyClump[] = [
  { x: 190, y: 180, rx: 64, ry: 49, birth: 3, front: false, tilt: -2 },
  { x: 132, y: 218, rx: 58, ry: 39, birth: 3, front: false, tilt: 5 },
  { x: 250, y: 216, rx: 61, ry: 42, birth: 3, front: false, tilt: -5 },
  { x: 112, y: 160, rx: 59, ry: 47, birth: 4, front: false, tilt: -5 },
  { x: 270, y: 155, rx: 61, ry: 49, birth: 4, front: false, tilt: 4 },
  { x: 190, y: 112, rx: 66, ry: 53, birth: 4, front: false, tilt: 1 },
  { x: 137, y: 91, rx: 54, ry: 42, birth: 5, front: false, tilt: -6 },
  { x: 245, y: 92, rx: 57, ry: 44, birth: 5, front: false, tilt: 6 },
  { x: 72, y: 200, rx: 48, ry: 38, birth: 5, front: false, tilt: 3 },
  { x: 312, y: 192, rx: 46, ry: 39, birth: 5, front: false, tilt: -4 },
  { x: 190, y: 58, rx: 48, ry: 36, birth: 6, front: false, tilt: 0 },
  { x: 86, y: 111, rx: 45, ry: 36, birth: 6, front: false, tilt: 4 },
  { x: 298, y: 108, rx: 46, ry: 37, birth: 6, front: false, tilt: -4 },
  { x: 93, y: 139, rx: 48, ry: 36, birth: 4, front: true, tilt: 5 },
  { x: 157, y: 115, rx: 55, ry: 39, birth: 4, front: true, tilt: -3 },
  { x: 226, y: 121, rx: 58, ry: 41, birth: 4, front: true, tilt: 3 },
  { x: 286, y: 143, rx: 48, ry: 38, birth: 5, front: true, tilt: -4 },
  { x: 73, y: 193, rx: 42, ry: 32, birth: 5, front: true, tilt: -2 },
  { x: 124, y: 211, rx: 51, ry: 34, birth: 3, front: true, tilt: 2 },
  { x: 193, y: 194, rx: 66, ry: 43, birth: 3, front: true, tilt: -1 },
  { x: 261, y: 210, rx: 54, ry: 35, birth: 3, front: true, tilt: 4 },
  { x: 315, y: 187, rx: 39, ry: 32, birth: 5, front: true, tilt: -3 },
  { x: 126, y: 75, rx: 42, ry: 31, birth: 6, front: true, tilt: -5 },
  { x: 194, y: 64, rx: 49, ry: 34, birth: 6, front: true, tilt: 1 },
  { x: 261, y: 77, rx: 43, ry: 32, birth: 6, front: true, tilt: 5 },
  { x: 164, y: 156, rx: 49, ry: 34, birth: 5, front: true, tilt: 4 },
  { x: 235, y: 161, rx: 48, ry: 34, birth: 5, front: true, tilt: -4 },
];

export function TreeArtDefs({ uid }: { uid: string }) {
  return <>
    <linearGradient id={`${uid}-bark`} x1="0" y1="0" x2="1" y2=".7">
      <stop stopColor="var(--konoha-bark-light)" />
      <stop offset=".44" stopColor="var(--konoha-bark-mid)" />
      <stop offset="1" stopColor="var(--konoha-bark-dark)" />
    </linearGradient>
    <linearGradient id={`${uid}-bough`} x1="0" y1="0" x2=".75" y2="1">
      <stop stopColor="var(--konoha-bark-light)" />
      <stop offset=".52" stopColor="var(--konoha-bark-mid)" />
      <stop offset="1" stopColor="var(--konoha-bark-dark)" />
    </linearGradient>
    <radialGradient id={`${uid}-canopy-back`} cx="35%" cy="24%" r="82%">
      <stop stopColor="var(--konoha-canopy-mid)" />
      <stop offset=".7" stopColor="var(--konoha-canopy-shadow)" />
      <stop offset="1" stopColor="var(--konoha-canopy-deep)" />
    </radialGradient>
    <radialGradient id={`${uid}-canopy-front`} cx="30%" cy="18%" r="88%">
      <stop stopColor="var(--konoha-canopy-light)" />
      <stop offset=".62" stopColor="var(--konoha-canopy-mid)" />
      <stop offset="1" stopColor="var(--konoha-canopy-shadow)" />
    </radialGradient>
    <linearGradient id={`${uid}-soil`} x1=".2" y1="0" x2=".8" y2="1">
      <stop stopColor="var(--konoha-soil-light)" />
      <stop offset="1" stopColor="var(--konoha-soil-dark)" />
    </linearGradient>
    <radialGradient id={`${uid}-ground`}>
      <stop stopColor="var(--konoha-ground-glow)" stopOpacity=".42" />
      <stop offset="1" stopColor="var(--konoha-ground-glow)" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={`${uid}-seed`} cx="30%" cy="20%" r="90%">
      <stop stopColor="#d7a85f" />
      <stop offset=".5" stopColor="#a86e32" />
      <stop offset="1" stopColor="#654024" />
    </radialGradient>
  </>;
}

const CanopyBubble = memo(function CanopyBubble({ uid, clump, index }: {
  uid: string;
  clump: CanopyClump;
  index: number;
}) {
  const highlightX = -clump.rx * .28;
  const highlightY = -clump.ry * .27;
  return <g className="konoha-canopy-clump" transform={`translate(${clump.x} ${clump.y}) rotate(${clump.tilt})`}>
    <g className="konoha-canopy-drift" style={{ animationDelay: `${index * -.61}s` }}>
      <ellipse rx={clump.rx} ry={clump.ry} fill={`url(#${uid}-canopy-${clump.front ? "front" : "back"})`} />
      <path d={`M${-clump.rx * .82} ${clump.ry * .13} Q0 ${clump.ry * .75} ${clump.rx * .82} ${clump.ry * .08}
        Q${clump.rx * .56} ${clump.ry * .74} 0 ${clump.ry * .86} Q${-clump.rx * .58} ${clump.ry * .7} ${-clump.rx * .82} ${clump.ry * .13}Z`}
        className="konoha-canopy-underpaint" />
      <ellipse cx={highlightX} cy={highlightY} rx={clump.rx * .36} ry={clump.ry * .22} className="konoha-canopy-highlight" />
    </g>
  </g>;
});

const AddedCanopy = memo(function AddedCanopy({ uid, front, count }: { uid: string; front: boolean; count: number }) {
  const added = Math.max(0, count - TREE_NODE_CAPACITY);
  return <>
    {Array.from({ length: added }, (_, index) => {
      const slot = TREE_NODE_CAPACITY + index;
      const [anchorX, anchorY] = getTreeAddedFruitCenter(slot);
      const low = anchorY > 250;
      const outer = anchorX < 55 || anchorX > 325;
      const clump: CanopyClump = {
        x: anchorX + (front ? (index % 2 ? 4 : -4) : 0),
        y: anchorY + (low ? -25 : front ? 7 : -5),
        rx: outer ? 54 : 48,
        ry: low ? 31 : 36,
        birth: 7,
        front,
        tilt: (index % 5 - 2) * 2,
      };
      return <CanopyBubble key={slot} uid={uid} clump={clump} index={slot + (front ? 29 : 0)} />;
    })}
  </>;
});

export const TreeCanopy = memo(function TreeCanopy({ uid, front, stage, count = stage }: {
  uid: string;
  front: boolean;
  stage: number;
  count?: number;
}) {
  const maturityScale = stage >= 12 ? 1.08 : stage >= 11 ? 1.055 : stage >= 10 ? 1.03 : 1;
  return <g className={`konoha-foliage konoha-foliage--${front ? "front" : "back"}`}
    transform={`translate(190 208) scale(${maturityScale}) translate(-190 -208)`}>
    {CANOPY_CLUMPS.map((clump, index) => clump.front === front && clump.birth <= stage
      ? <CanopyBubble key={index} uid={uid} clump={clump} index={index} />
      : null)}
    {stage >= 7 ? <AddedCanopy uid={uid} front={front} count={count} /> : null}
    {front && stage >= 8 ? <g className="konoha-canopy-brush-lights" aria-hidden="true">
      <ellipse cx="105" cy="151" rx="20" ry="8" />
      <ellipse cx="211" cy="91" rx="25" ry="9" />
      <ellipse cx="278" cy="177" rx="18" ry="7" />
    </g> : null}
  </g>;
});

export function TreeGround({ uid, stage, front }: { uid: string; stage: number; front: boolean }) {
  const radius = stage <= 2 ? 43 + stage * 7 : Math.min(118, 55 + stage * 6);
  if (!front) return <g className="konoha-soil konoha-soil--back" data-soil-layer="back">
    <ellipse cx="190" cy="397" rx={radius + 22} ry={stage <= 2 ? 13 : 18} fill={`url(#${uid}-ground)`} />
    <ellipse cx="190" cy="391" rx={radius} ry={stage <= 2 ? 10 : 14} fill={`url(#${uid}-soil)`} />
  </g>;

  return <g className="konoha-soil konoha-soil--front" data-soil-layer="front">
    <path d={`M${190 - radius} 391 Q190 ${stage <= 2 ? 410 : 414} ${190 + radius} 391 Q190 ${stage <= 2 ? 399 : 404} ${190 - radius} 391Z`}
      className="konoha-soil-face" />
    <path d={`M${190 - radius * .82} 394 Q${190 - radius * .42} 399 ${190 - radius * .08} 396
      M${190 + radius * .18} 399 Q${190 + radius * .48} 394 ${190 + radius * .78} 396`} className="konoha-soil-ridge" />
    <g className="konoha-soil-specks">
      <circle cx={190 - radius * .58} cy="397" r="1.4" />
      <circle cx={190 + radius * .51} cy="398" r="1.1" />
      {stage >= 3 ? <circle cx={190 + radius * .16} cy="403" r=".85" /> : null}
    </g>
  </g>;
}

export function TreeSeedling({ uid, stage }: { uid: string; stage: number }) {
  const opened = stage >= 2;
  const height = opened ? 46 : 31;
  const leaf = <>
    <path d="M0 0 C-8 1 -22 -4 -27 -14 C-18 -20 -4 -15 0 0Z" className="konoha-sprout-leaf" />
    <path d="M-1 -1 Q-12 -9 -24 -13 M-9 -6 L-14 -3" className="konoha-sprout-vein" />
  </>;

  return <g className="konoha-seedling" transform="translate(190 385)" opacity={stage === 1 || stage === 2 ? 1 : 0}>
    <g className="konoha-seedling-stem" style={{ transform: `scaleY(${height / 46})` }}>
      <path d="M0 0 C3 -15 -3 -31 0 -46" className="konoha-sprout-stem" />
      <path d="M-.6 -1 C1 -16 -3 -31 -.4 -45" className="konoha-sprout-stem-light" />
    </g>
    <g className="konoha-cotyledon-joint" style={{ transform: `translateY(${-height}px)` }}>
      <g className="konoha-cotyledon" data-cotyledon="left" style={{ transform: opened ? "rotate(4deg) scale(1.08)" : "rotate(20deg) scale(1)" }}>{leaf}</g>
      <g className="konoha-cotyledon" data-cotyledon="right" style={{ transform: opened ? "rotate(-4deg) scale(1.08)" : "rotate(-58deg) scale(.1)", opacity: opened ? 1 : 0 }}>
        <g transform="scale(-1 1)">{leaf}</g>
      </g>
      {!opened ? <g className="konoha-seed" transform="rotate(-9)" data-seed-visible="true">
        <path d="M-1 1 C-10 3 -14 -3 -12 -10 C-7 -11 -2 -8 1 -3Z" fill={`url(#${uid}-seed)`} />
        <path d="M1 0 C8 3 13 -1 13 -7 C9 -10 4 -8 0 -4Z" fill={`url(#${uid}-seed)`} />
        <path d="M-9 -7 Q-5 -4 -1 -3 M9 -7 Q5 -4 1 -3" className="konoha-seed-shine" />
      </g> : null}
    </g>
  </g>;
}

const TreeBough = memo(function TreeBough({ uid, branch }: { uid: string; branch: ReturnType<typeof getTreeStructure>[number] }) {
  return <g className="konoha-bough">
    <path d={branch.surface} fill={`url(#${uid}-bough)`} />
    <path d={branch.path} className="konoha-bough-light" strokeWidth={branch.width > 10 ? 1.25 : .65} />
  </g>;
});

function matureTrunkPath(stage: number) {
  const width = Math.max(0, stage - 5) * 1.6;
  return `M${166 - width} 390 C${169 - width * .5} 366 174 338 176 310
    C178 280 178 240 184 195 Q190 183 197 195 C202 235 200 274 203 310
    C205 340 211 368 ${222 + width} 390 Q205 384 195 378 Q181 385 ${166 - width} 390Z`;
}

export const TreeWood = memo(function TreeWood({ uid, stage, appearanceStage }: {
  uid: string;
  stage: number;
  appearanceStage: number;
}) {
  const branches = getTreeStructure(stage, false, TREE_NODE_CAPACITY);
  const youngTrunks = {
    3: { d: "M190 386 C191 349 187 309 191 244", width: 7 },
    4: { d: "M190 386 C193 345 186 291 192 216", width: 8.5 },
    5: { d: "M190 386 C194 339 185 269 193 188", width: 10 },
    6: { d: "M190 386 C195 335 185 251 194 171", width: 11.5 },
  } as const;
  const youngTrunk = youngTrunks[stage as keyof typeof youngTrunks] ?? youngTrunks[6];
  return <>
    <g className="konoha-trunk-detail" opacity={stage >= 7 ? 1 : 0}>
      <path d="M183 367 Q168 383 143 391 Q169 393 185 381 M201 369 Q218 386 244 392 Q218 393 201 381Z"
        className="konoha-tree-roots" />
      <path d={matureTrunkPath(appearanceStage)} fill={`url(#${uid}-bark)`} />
      <path d="M181 380 C187 350 184 319 189 286 C192 252 188 225 191 202" className="konoha-bark-light" />
      <path d="M201 373 C196 344 201 321 196 294 M181 333 Q187 319 184 302" className="konoha-bark-shadow" />
    </g>
    <g className="konoha-young-wood" opacity={stage >= 3 && stage < 7 ? 1 : 0}>
      <path className="konoha-young-trunk" pathLength="1" d={youngTrunk.d} fill="none" stroke={`url(#${uid}-bark)`}
        strokeWidth={youngTrunk.width} strokeLinecap="round" />
      <path d={youngTrunk.d} className="konoha-young-trunk-light" />
    </g>
    <g className="konoha-wood-branches" data-branch-count={branches.length}>
      {branches.map((branch, index) => <TreeBough key={index} uid={uid} branch={branch} />)}
    </g>
  </>;
});
