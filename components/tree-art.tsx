import { memo } from "react";
import { getTreeStructure } from "@/lib/tree-branches";

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
}));

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

export const TreeCanopy = memo(function TreeCanopy({ uid, front }: { uid: string; front: boolean }) {
  return <g className={`konoha-foliage konoha-foliage--${front ? "front" : "back"}`}>
    {CROWN.map((clump, index) => clump.front === front && <g key={index} transform={`translate(${clump.x} ${clump.y})`}>
      <g className="konoha-canopy-drift" style={{ animationDelay: `${index * -.73}s` }}>
        {clump.mesh.map((mesh, shade) => <g key={shade}>
          <path d={mesh.leaves} fill={`url(#${uid}-leaf-${shade})`} />
          <path d={mesh.folds} fill={`var(--konoha-leaf-${Math.min(7, shade + 1)})`} opacity=".52" />
        </g>)}
      </g>
    </g>)}
  </g>;
});

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

export const TreeWood = memo(function TreeWood({ uid, stage }: { uid: string; stage: number }) {
  const branches = getTreeStructure(stage, false);
  return <>
    <g className="konoha-trunk-detail" opacity={stage >= 4 ? 1 : 0}>
      <g filter={`url(#${uid}-wood-grain)`}>
        <path d="M182 363 Q165 381 132 390 Q155 393 177 384 L185 374 M201 367 Q222 386 255 392 Q229 394 207 383Z" fill="#586045" />
        <path d={TRUNK} fill={`url(#${uid}-bark)`} />
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
    <path className="konoha-young-trunk" pathLength="1" d="M188 384 C197 343 181 296 194 251 Q206 210 200 165" fill="none" stroke={`url(#${uid}-bark)`} strokeWidth="6" strokeLinecap="round"
      opacity={stage < 4 ? 1 : 0} style={{ strokeDashoffset: stage <= 2 ? .36 : 0 }} />
    <g className="konoha-wood-branches" data-branch-count={branches.length}>
      {branches.map((branch, index) => <g key={index} className="konoha-bough">
        <path d={branch.surface} fill={`url(#${uid}-bough)`} />
        <path d={branch.path} fill="none" stroke="#b3ab81" strokeWidth={branch.width > 10 ? 1.1 : .55} strokeLinecap="round" opacity=".38" />
      </g>)}
    </g>
  </>;
});
