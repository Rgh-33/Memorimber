import { memo } from "react";
import { getTreeAddedFruitCenter, getTreeStructure, getTreeTrunkScale, TREE_NODE_CAPACITY } from "@/lib/tree-branches";

const TRUNK = "M153 388 C169 376 173 357 172 338 C171 315 183 287 180 264 C177 246 174 227 180 214 L187 220 C188 237 186 249 192 254 C203 237 214 211 216 190 L223 185 C225 214 208 246 204 267 C208 293 196 322 199 342 C202 363 215 379 237 390 L211 386 199 381 Q181 385 164 390Z";

// Overlapping ellipsoids are populated with individual, lit leaves. Small leaf
// silhouettes and cast shadows give the crown its depth. These deterministic
// meshes are shared by all trees.
const CLUMPS = [
  [93, 123, 48, 40, 0], [151, 93, 49, 40, 0], [213, 100, 47, 45, 0],
  [270, 121, 49, 43, 0], [303, 102, 33, 29, 0], [311, 173, 34, 41, 0],
  [66, 185, 35, 37, 0], [111, 221, 44, 33, 0], [260, 218, 51, 37, 0],
  [192, 173, 60, 41, 0], [78, 95, 32, 25, 0],
  [90, 132, 34, 27, 1], [142, 98, 37, 28, 1], [207, 78, 39, 27, 1],
  [274, 113, 38, 32, 1], [308, 170, 29, 29, 1], [66, 200, 26, 25, 1],
  [130, 184, 35, 27, 1], [197, 149, 43, 33, 1], [260, 178, 36, 29, 1],
  [269, 234, 33, 26, 1], [111, 241, 35, 24, 1],
  [151, 62, 33, 26, 0], [191, 48, 30, 25, 0], [235, 67, 29, 25, 0],
  [169, 59, 29, 23, 1], [208, 52, 27, 24, 1],
] as const;

function leafMesh(rx: number, ry: number, seed: number, front: boolean) {
  let state = seed * 9176 + 231;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const bins = Array.from({ length: 8 }, () => ({ leaves: "", folds: "" }));
  const count = Math.round(rx * ry / 5.5);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963 + seed;
    const radius = Math.sqrt((i + .5) / count);
    const x = Math.cos(angle) * radius * rx;
    const y = Math.sin(angle) * radius * ry;
    const depth = Math.sqrt(1 - radius * radius);
    const rotation = random() * Math.PI;
    const length = 3.2 + random() * 2.8;
    const breadth = 2.2 + random() * 2;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const p = (a: number, b: number) => `${(x + a * c - b * s).toFixed(1)} ${(y + a * s + b * c).toFixed(1)}`;
    const light = .26 + depth * .27 - x / rx * .1 - y / ry * .2 + random() * .16 + (front ? .07 : -.09);
    const bin = bins[Math.max(0, Math.min(7, Math.floor(light * 8)))];
    bin.leaves += `M${p(-length, 0)}Q${p(-length * .3, -breadth * 1.4)} ${p(length, 0)}Q${p(length * .2, breadth * 1.4)} ${p(-length, 0)}Z`;
    if (random() > .4) bin.folds += `M${p(-length * .8, 0)}Q${p(-length * .2, -breadth)} ${p(length * .8, 0)}Q${p(0, breadth * .05)} ${p(-length * .8, 0)}Z`;
  }
  return bins;
}

const CROWN = CLUMPS.map(([x, y, rx, ry, front], index) => ({
  x, y, front: Boolean(front), mesh: leafMesh(rx, ry, index + 1, Boolean(front)),
  // Central leaves appear first; outer and upper clumps arrive as the trunk
  // forks. All clumps are present at stage 7, preserving the mature crown.
  birth: [5, 4, 4, 5, 6, 6, 6, 4, 4, 3, 6, 5, 4, 4, 5, 6, 5, 4, 3, 4, 5, 4, 6, 6, 6, 6, 6][index],
}));

// Each new fruit grows a pair of overlapping leaf masses around its connected
// branch tip. Their order matches slots 13-33: crown first, then shoulders,
// sides and finally the low skirt of the umbrella-shaped canopy.
const ADDED_FOLIAGE = [
  { source: 9, frontSource: 18, scaleX: 1.35, scaleY: .78 },
  { source: 0, frontSource: 12, scaleX: 1.1, scaleY: .78 },
  { source: 2, frontSource: 19, scaleX: 1.12, scaleY: .8 },
  { source: 7, frontSource: 16, scaleX: 1.12, scaleY: .92 },
  { source: 8, frontSource: 20, scaleX: 1.08, scaleY: .92 },
  { source: 0, frontSource: 11, scaleX: 1.08, scaleY: .92 },
  { source: 3, frontSource: 14, scaleX: 1.08, scaleY: .9 },
  { source: 10, frontSource: 11, scaleX: 1.08, scaleY: .88 },
  { source: 4, frontSource: 14, scaleX: 1.05, scaleY: .88 },
  { source: 0, frontSource: 16, scaleX: 1.15, scaleY: .92 },
  { source: 3, frontSource: 15, scaleX: 1.15, scaleY: .92 },
  { source: 7, frontSource: 17, scaleX: .98, scaleY: .8 },
  { source: 8, frontSource: 19, scaleX: .96, scaleY: .8 },
  { source: 9, frontSource: 18, scaleX: .9, scaleY: .78 },
  { source: 1, frontSource: 12, scaleX: 1.05, scaleY: .82 },
  { source: 2, frontSource: 13, scaleX: 1.05, scaleY: .82 },
  { source: 10, frontSource: 11, scaleX: 1.15, scaleY: .86 },
  { source: 4, frontSource: 14, scaleX: 1.1, scaleY: .86 },
  { source: 7, frontSource: 16, scaleX: 1.08, scaleY: .86 },
  { source: 8, frontSource: 20, scaleX: 1.04, scaleY: .86 },
  { source: 9, frontSource: 18, scaleX: 1.15, scaleY: .78 },
] as const;

export function TreeArtDefs({ uid }: { uid: string }) {
  return <>
    <linearGradient id={`${uid}-bark`} x1="0" y1=".25" x2="1" y2=".45">
      <stop stopColor="#393e32" /><stop offset=".2" stopColor="#7c785a" />
      <stop offset=".39" stopColor="#a69b75" /><stop offset=".52" stopColor="#706750" />
      <stop offset=".78" stopColor="#514d3b" /><stop offset="1" stopColor="#30392e" />
    </linearGradient>
    <linearGradient id={`${uid}-bough`} x1="0" y1="0" x2=".25" y2="1">
      <stop stopColor="#9b9472" /><stop offset=".4" stopColor="#756f51" /><stop offset="1" stopColor="#3c4433" />
    </linearGradient>
    <radialGradient id={`${uid}-moss`} cx=".3" cy=".25" r=".85">
      <stop stopColor="#8a9860" /><stop offset=".45" stopColor="#596b42" /><stop offset="1" stopColor="#2d4332" />
    </radialGradient>
    <radialGradient id={`${uid}-ground`}>
      <stop stopColor="#344630" stopOpacity=".3" /><stop offset=".45" stopColor="#667851" stopOpacity=".13" /><stop offset="1" stopColor="#83916c" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`${uid}-soil-back`} x1="0" y1="0" x2=".25" y2="1">
      <stop stopColor="#9a8763" /><stop offset=".35" stopColor="#76664c" />
      <stop offset=".72" stopColor="#554a3a" /><stop offset="1" stopColor="#3d3b31" />
    </linearGradient>
    <linearGradient id={`${uid}-soil-front`} x1=".15" y1="0" x2=".8" y2="1">
      <stop stopColor="#8f7956" /><stop offset=".45" stopColor="#65553f" />
      <stop offset="1" stopColor="#454036" />
    </linearGradient>
    <radialGradient id={`${uid}-seed`} cx=".28" cy=".2" r=".9">
      <stop stopColor="#d8b77d" /><stop offset=".38" stopColor="#a97c45" />
      <stop offset=".78" stopColor="#725033" /><stop offset="1" stopColor="#46372c" />
    </radialGradient>
    {Array.from({ length: 8 }, (_, i) => <linearGradient key={i} id={`${uid}-leaf-${i}`} x1="0" y1="0" x2=".6" y2="1">
      <stop stopColor={`var(--konoha-leaf-${i})`} /><stop offset="1" stopColor={`var(--konoha-leaf-${Math.max(0, i - 1)})`} />
    </linearGradient>)}
    <filter id={`${uid}-wood-grain`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".22 .045" numOctaves="3" seed="8" result="grain" />
      <feColorMatrix in="grain" type="saturate" values="0" />
      <feComponentTransfer><feFuncA type="linear" slope=".32" /></feComponentTransfer>
      <feBlend in="SourceGraphic" mode="soft-light" /><feComposite in2="SourceGraphic" operator="in" />
    </filter>
    <clipPath id={`${uid}-trunk-clip`}><path d={TRUNK} /></clipPath>
  </>;
}

const LeafClumpDefinitions = memo(function LeafClumpDefinitions({ uid, stage }: { uid: string; stage: number }) {
  return <defs>
    {CROWN.map((clump, index) => clump.birth <= stage && <g key={index} id={`${uid}-leaf-clump-${index}`}>
      {clump.mesh.map((mesh, shade) => <g key={shade}>
        <path d={mesh.leaves} fill={`url(#${uid}-leaf-${shade})`} />
        <path d={mesh.folds} fill={`var(--konoha-leaf-${Math.min(7, shade + 1)})`} opacity=".52" />
      </g>)}
    </g>)}
  </defs>;
});

const BaseCanopy = memo(function BaseCanopy({ uid, front, stage }: { uid: string; front: boolean; stage: number }) {
  return <>
    {CROWN.map((clump, index) => clump.front === front && clump.birth <= stage && <g key={index} className="konoha-canopy-clump" transform={`translate(${clump.x} ${clump.y})`}>
      <g className="konoha-canopy-drift" style={{ animationDelay: `${index * -.73}s` }}>
        <use href={`#${uid}-leaf-clump-${index}`} />
      </g>
    </g>)}
  </>;
});

const AddedCanopy = memo(function AddedCanopy({ uid, front, count }: { uid: string; front: boolean; count: number }) {
  const added = Math.max(0, Math.min(ADDED_FOLIAGE.length, count - TREE_NODE_CAPACITY));
  return <>
    {ADDED_FOLIAGE.slice(0, added).map((layout, index) => {
      const slot = TREE_NODE_CAPACITY + index;
      const [anchorX, anchorY] = getTreeAddedFruitCenter(slot);
      const frontDrift = front ? (index % 2 === 0 ? -4 : 4) : 0;
      const xScale = front ? layout.scaleX * .78 : layout.scaleX;
      const yScale = front ? layout.scaleY * .78 : layout.scaleY;
      const needsConnector = anchorX < 55 || anchorX > 325;
      const connectorX = 190 + (anchorX - 190) * .64;
      const connectorY = anchorY < 80 ? anchorY + 34 : anchorY > 250 ? anchorY - 30 : anchorY;
      const canopyY = anchorY > 250 ? anchorY - 28 : anchorY;
      const connectorSource = front ? (anchorX < 190 ? 17 : 19) : (anchorX < 190 ? 0 : 3);
      return <g key={slot} data-added-canopy-slot={slot}>
        {needsConnector && <g className="konoha-canopy-clump konoha-canopy-clump--extension konoha-canopy-clump--connector"
          transform={`translate(${connectorX + frontDrift} ${connectorY + (front ? 7 : -4)}) scale(${front ? .92 : 1.2} ${front ? .68 : .8})`}>
          <g className="konoha-canopy-drift" style={{ animationDelay: `${(index + (front ? 71 : 67)) * -.39}s` }}>
            <use href={`#${uid}-leaf-clump-${connectorSource}`} />
          </g>
        </g>}
        <g className="konoha-canopy-clump konoha-canopy-clump--extension"
          transform={`translate(${anchorX + frontDrift} ${canopyY + (front ? 8 : -6)}) scale(${xScale} ${yScale})`}>
          <g className="konoha-canopy-drift" style={{ animationDelay: `${(index + (front ? 53 : 31)) * -.43}s` }}>
            <use href={`#${uid}-leaf-clump-${front ? layout.frontSource : layout.source}`} />
          </g>
        </g>
      </g>;
    })}
  </>;
});

export const TreeCanopy = memo(function TreeCanopy({ uid, front, stage, count = stage }: { uid: string; front: boolean; stage: number; count?: number }) {
  return <g className={`konoha-foliage konoha-foliage--${front ? "front" : "back"}`}>
    {!front && <LeafClumpDefinitions uid={uid} stage={stage} />}
    <BaseCanopy uid={uid} front={front} stage={stage} />
    {stage >= 7 && <AddedCanopy uid={uid} front={front} count={count} />}
  </g>;
});

export function TreeGround({ uid, stage, front }: { uid: string; stage: number; front: boolean }) {
  const radius = stage <= 2 ? 34 + stage * 8 : 50 + stage * 10;
  const left = 190 - radius;
  const right = 190 + radius;
  if (!front) return <g className="konoha-soil konoha-soil--back" data-soil-layer="back">
    <ellipse cx="190" cy="394" rx={radius + 13} ry={stage <= 2 ? 15 : 19} fill={`url(#${uid}-ground)`} />
    <path d={`M${left} 392 C${190 - radius * .88} 384 ${190 - radius * .7} 386 ${190 - radius * .53} 382
      C${190 - radius * .35} 378 ${190 - radius * .17} 384 190 381
      C${190 + radius * .18} 378 ${190 + radius * .33} 384 ${190 + radius * .51} 382
      C${190 + radius * .68} 380 ${190 + radius * .84} 386 ${right} 392
      L${right - 3} 399 Q190 ${stage <= 2 ? 404 : 407} ${left + 3} 399Z`} fill={`url(#${uid}-soil-back)`} />
    <path d={`M${left + radius * .18} 390 Q${190 - radius * .55} 384 ${190 - radius * .37} 387
      M${190 + radius * .28} 385 Q${190 + radius * .52} 381 ${right - radius * .13} 391`}
      className="konoha-soil-ridge" />
    <g className="konoha-soil-specks">
      <ellipse cx={190 - radius * .58} cy="390" rx="3.4" ry="1.8" />
      <ellipse cx={190 + radius * .62} cy="391" rx="2.8" ry="1.5" />
      <circle cx={190 - radius * .26} cy="385" r="1.25" />
      <circle cx={190 + radius * .34} cy="386" r="1" />
    </g>
  </g>;

  return <g className="konoha-soil konoha-soil--front" data-soil-layer="front">
    <path d={`M${left + 3} 391 C${190 - radius * .76} 389 ${190 - radius * .56} 386 ${190 - radius * .38} 389
      C${190 - radius * .2} 392 ${190 - radius * .1} 384 190 387
      C${190 + radius * .13} 383 ${190 + radius * .23} 392 ${190 + radius * .4} 388
      C${190 + radius * .6} 385 ${190 + radius * .78} 390 ${right - 3} 391
      Q${right - 5} 400 190 ${stage <= 2 ? 404 : 407} Q${left + 5} 400 ${left + 3} 391Z`}
      fill={`url(#${uid}-soil-front)`} />
    <path d={`M${left + 8} 392 Q${190 - radius * .68} 387 ${190 - radius * .47} 390
      M${190 + radius * .43} 389 Q${190 + radius * .65} 386 ${right - 8} 392`}
      className="konoha-soil-front-ridge" />
    {stage === 1 && <path d="M177 388 Q183 383 190 386 Q196 382 203 388" className="konoha-seed-gap" />}
    <g className="konoha-soil-pebbles">
      <ellipse cx={190 - radius * .7} cy="395" rx="3.2" ry="1.5" />
      <ellipse cx={190 + radius * .52} cy="396" rx="2.3" ry="1.15" />
      {stage >= 3 && <><circle cx={190 - radius * .34} cy="399" r="1.25" /><circle cx={190 + radius * .73} cy="393" r=".9" /></>}
    </g>
  </g>;
}

export function TreeSeed({ uid }: { uid: string }) {
  return <g className="konoha-seed" transform="translate(190 388) rotate(-8)" data-seed-visible="true">
    <ellipse rx="8.5" ry="8.2" fill={`url(#${uid}-seed)`} stroke="#4f3d2d" strokeWidth=".65" />
    <path d="M-6 -2 Q-1 -7 5 -4" fill="none" stroke="#e5c892" strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
    <path d="M0 -7 Q-2 -4 -1 -1 M0 -7 Q2 -4 1 -1" fill="none" stroke="#5c432f" strokeWidth=".75" strokeLinecap="round" opacity=".72" />
    <path d="M1 -7 Q3 -9 5 -10" fill="none" stroke="#6d7e4d" strokeWidth="1.2" strokeLinecap="round" />
  </g>;
}

export function TreeSeedling({ uid, stage }: { uid: string; stage: number }) {
  const opened = stage >= 2;
  const height = opened ? 44 : 30;
  const leaf = <>
    <path d="M0 0 C-14 5 -35 -3 -42 -18 C-30 -26 -7 -21 0 0Z" fill={`url(#${uid}-leaf-4)`} />
    <path d="M-1 -1 Q-20 -13 -39 -18 M-13 -8 L-21 -5 M-23 -13 L-27 -20" fill="none" stroke="#d7deb3" strokeWidth=".7" opacity=".52" strokeLinecap="round" />
    <path d="M-1 0 Q-22 -1 -39 -16" fill="none" stroke="#435c37" strokeWidth=".65" opacity=".45" />
  </>;

  return <g className="konoha-seedling" transform="translate(190 385)" opacity={stage === 1 || stage === 2 ? 1 : 0}>
    <g className="konoha-seedling-stem" style={{ transform: `scaleY(${height / 44})` }}>
      <path d="M0 0 C4 -13 -4 -29 0 -44" fill="none" stroke="var(--leaf-color)" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M-.6 -1 C2 -13 -4 -29 -.6 -43" fill="none" stroke="#b2be86" strokeWidth=".7" strokeLinecap="round" />
    </g>
    <g className="konoha-cotyledon-joint" style={{ transform: `translateY(${-height}px)` }}>
      <g className="konoha-cotyledon" data-cotyledon="left" style={{ transform: opened ? "rotate(0deg) scale(1)" : "rotate(24deg) scale(.8)" }}>{leaf}</g>
      <g className="konoha-cotyledon" data-cotyledon="right" style={{ transform: opened ? "rotate(-8deg) scale(1)" : "rotate(-64deg) scale(.1)", opacity: opened ? 1 : 0 }}>
        <g transform="scale(-1 1)">{leaf}</g>
      </g>
    </g>
  </g>;
}

const TreeBough = memo(function TreeBough({ uid, branch }: { uid: string; branch: ReturnType<typeof getTreeStructure>[number] }) {
  return <g className="konoha-bough">
    <path d={branch.surface} fill={`url(#${uid}-bough)`} />
    <path d={branch.path} fill="none" stroke="#b3ab81" strokeWidth={branch.width > 10 ? 1.1 : .55} strokeLinecap="round" opacity=".38" />
  </g>;
});

function matureTrunkPath(scale: number) {
  const spread = Math.max(0, scale - 1) * 42;
  return `M${153 - spread} 388 C${169 - spread * .55} 376 ${173 - spread * .42} 357 ${172 - spread * .4} 338
    C${171 - spread * .32} 315 ${183 - spread * .12} 287 180 264 C177 246 174 227 180 214 L187 220
    C188 237 186 249 192 254 C203 237 214 211 216 190 L223 185 C225 214 208 246 204 267
    C${208 + spread * .12} 293 ${196 + spread * .42} 322 ${199 + spread * .45} 342
    C${202 + spread * .5} 363 ${215 + spread * .65} 379 ${237 + spread} 390
    L${211 + spread * .42} 386 ${199 + spread * .18} 381 Q${181 - spread * .18} 385 ${164 - spread * .42} 390Z`;
}

export const TreeWood = memo(function TreeWood({ uid, stage, count = stage }: { uid: string; stage: number; count?: number }) {
  // Extra tips still have connected branch geometry for placement, but their
  // slender supporting wood stays inside the dense canopy. Rendering only the
  // established skeleton prevents stray twigs from poking below or sideways.
  const branches = getTreeStructure(stage, false, TREE_NODE_CAPACITY);
  const youngTrunks = {
    3: { d: "M190 384 C193 354 184 313 192 238", width: 7.4 },
    4: { d: "M190 384 C197 346 181 287 194 207", width: 7.1 },
    5: { d: "M189 384 C198 340 180 270 195 183", width: 6.7 },
    6: { d: "M189 384 C199 336 180 252 198 165", width: 6.3 },
  } as const;
  const youngTrunk = youngTrunks[stage as keyof typeof youngTrunks] ?? youngTrunks[6];
  const trunkScale = getTreeTrunkScale(count);
  const matureTrunk = matureTrunkPath(trunkScale);
  return <>
    <g className="konoha-trunk-detail" opacity={stage >= 7 ? 1 : 0}>
      <g filter={`url(#${uid}-wood-grain)`}>
        <path d="M182 363 Q165 381 132 390 Q155 393 177 384 L185 374 M201 367 Q222 386 255 392 Q229 394 207 383Z" fill="#586045" />
        <path d={matureTrunk} fill={`url(#${uid}-bark)`} />
        <g clipPath={`url(#${uid}-trunk-clip)`}>
          <path d="M181 387 C205 359 179 341 193 307 S187 266 202 238 L209 218 C206 253 215 278 205 307 S205 357 214 387Z" fill="#373e30" opacity=".4" />
          <path d="M169 389 C187 366 180 345 187 322 S194 284 190 270" fill="none" stroke="#bbb18a" strokeWidth="3.5" opacity=".36" />
          <path d="M183 383 C196 363 185 351 191 332 S202 305 197 288 M174 374 Q181 354 178 338 M201 377 Q196 361 196 347 M185 319 Q181 305 189 285 M185 255 Q176 235 183 223 M201 255 Q206 240 212 228" className="konoha-bark-groove" />
          <path d="M181 378 Q189 361 187 350 M191 324 Q197 312 195 301 M192 267 Q188 258 191 248 M206 372 Q200 360 202 351 M178 351 L181 337" className="konoha-bark-ridge" />
          <path d="M171 381 C179 362 170 351 181 325 Q188 313 183 298 Q174 318 171 344Z M201 266 Q210 278 203 296 L206 279Z" fill={`url(#${uid}-moss)`} opacity=".87" />
          <path d="M195 303 C183 292 188 276 195 275 C204 279 206 297 195 303Z" fill="#3d4232" />
          <path d="M193 299 Q187 288 194 281 Q201 288 193 299Z" fill="#6e7050" />
          <path d="M195 297 Q190 290 195 285" fill="none" stroke="#ada47a" strokeWidth=".8" />
        </g>
      </g>
      <g fill={`url(#${uid}-moss)`}>
        <path d="M146 389 Q163 380 177 379 Q173 386 163 389Z M199 383 Q210 380 222 388 L209 388Z" />
        <path d="M153 387 l-4 -6 7 4 -1 -8 5 7 4 -4 -1 6 M217 388 l3 -7 2 5 5 -3 -3 6" opacity=".8" />
      </g>
    </g>
    <g className="konoha-young-wood" opacity={stage >= 3 && stage < 7 ? 1 : 0}>
      <path className="konoha-young-trunk" pathLength="1" d={youngTrunk.d} fill="none" stroke={`url(#${uid}-bark)`} strokeWidth={youngTrunk.width} strokeLinecap="round" />
      <path d={youngTrunk.d} fill="none" stroke="#bdb58d" strokeWidth=".75" strokeLinecap="round" opacity=".42" />
    </g>
    <g className="konoha-wood-branches" data-branch-count={branches.length}>
      {branches.map((branch, index) => <TreeBough key={index} uid={uid} branch={branch} />)}
    </g>
  </>;
});
