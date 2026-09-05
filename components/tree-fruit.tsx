import type { FruitAppearance } from "@/lib/tree-fruit-layout";

type FruitGlassPalette = {
  light: string;
  glow: string;
  mid: string;
  edge: string;
  shadow: string;
  glint: string;
};

const FRUIT_GLASS_COLORS: Record<FruitAppearance["variety"], FruitGlassPalette> = {
  "le-lectier": { light: "#fff3cf", glow: "#ffc05f", mid: "#d875bd", edge: "#6077c8", shadow: "#34345f", glint: "#c8edff" },
  apple: { light: "#fff2d5", glow: "#ffb96f", mid: "#e25f89", edge: "#ae3970", shadow: "#542a4b", glint: "#ffd4e9" },
  breadfruit: { light: "#fff0ca", glow: "#d99bea", mid: "#8e4db8", edge: "#554098", shadow: "#292552", glint: "#e8d7ff" },
  "dragon-fruit": { light: "#fff0ca", glow: "#ffbd60", mid: "#e97368", edge: "#bc3e69", shadow: "#602b4d", glint: "#ffe0c0" },
  "jatropha-curcas": { light: "#f5f5cb", glow: "#98df91", mid: "#2dafaa", edge: "#147b8b", shadow: "#1c4d60", glint: "#d1fff7" },
  "nikkori-pear": { light: "#fff1d1", glow: "#d2a0e7", mid: "#8371c8", edge: "#4d5da3", shadow: "#2c3059", glint: "#dce7ff" },
};

function FruitArtwork({ uid, variety, mature, fill }: {
  uid: string;
  variety: FruitAppearance["variety"];
  mature: boolean;
  fill: string;
}) {
  const metal = `url(#${uid}-gilt)`;
  const facets = `url(#${uid}-facet-light)`;
  const depth = `url(#${uid}-glass-depth)`;
  const bloom = `url(#${uid}-glass-bloom)`;

  return <>
    {variety === "le-lectier" && <g>
      <path d="M0 -13 C-6 -12 -11 -7 -13 1 C-15 9 -10 17 0 23 C10 17 15 9 13 1 C11 -7 6 -12 0 -13Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth=".9" className="konoha-glass-shell" />
      <path d="M0 -12 C-6 -10 -10 -5 -11 2 C-12 10 -7 16 0 21 C-3 12 -4 2 0 -12Z" fill={depth} className="konoha-glass-depth" />
      <ellipse cx="2" cy="5" rx="8.5" ry="11" fill={bloom} className="konoha-glass-bloom" />
      <path d="M0 -11 L-7 0 L-5 11 L0 22 L5 11 L7 0Z M-7 0 L0 5 L7 0 M-5 11 L0 5 L5 11"
        fill="none" stroke={facets} strokeWidth=".55" strokeLinejoin="round" className="konoha-crystal-facets" />
      <path d="M-8 -2 C-11 4 -10 10 -6 14" className="konoha-glass-highlight" />
      <path d="M0 -12 C-4 -13 -7 -16 -7 -19 C-3 -19 -1 -17 0 -14 C2 -18 6 -19 9 -18 C7 -15 4 -13 0 -12Z"
        fill={metal} stroke="#7f5817" strokeWidth=".35" className="konoha-gilt-calyx" />
      <path d="M0 -15 C-2 -21 0 -25 3 -28" stroke={metal} className="konoha-gilt-stem" />
      <path d="M3 -25 C8 -30 15 -30 19 -27 C16 -21 10 -19 4 -22Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M5 -23 C10 -25 14 -27 18 -27" className="konoha-leaf-vein" />
    </g>}

    {variety === "apple" && <g>
      <path d="M0 -8 C-4 -13 -12 -13 -17 -7 C-22 0 -17 11 0 20 C17 11 22 0 17 -7 C12 -13 4 -13 0 -8Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth=".9" className="konoha-glass-shell" />
      <path d="M0 -7 C-5 -11 -12 -10 -15 -5 C-18 1 -13 10 0 18 C-4 9 -5 1 0 -7Z" fill={depth} className="konoha-glass-depth" />
      <ellipse cx="3" cy="3" rx="10" ry="9.5" fill={bloom} className="konoha-glass-bloom" />
      <path d="M0 -7 C-5 -5 -9 -1 -10 6 L0 19 L10 6 C9 -1 5 -5 0 -7Z M-10 6 L0 2 L10 6 M0 2 L0 18"
        fill="none" stroke={facets} strokeWidth=".5" className="konoha-crystal-facets" />
      <path d="M-12 -4 C-16 0 -14 7 -10 10" className="konoha-glass-highlight" />
      <path d="M0 -9 C-4 -10 -7 -13 -7 -16 C-3 -16 -1 -14 0 -11 C2 -15 6 -17 9 -15 C7 -12 4 -10 0 -9Z"
        fill={metal} stroke="#805a1b" strokeWidth=".35" className="konoha-gilt-calyx" />
      <path d="M0 -12 C-1 -18 1 -22 4 -25" stroke={metal} className="konoha-gilt-stem" />
      <path d="M3 -20 C8 -25 14 -24 18 -21 C14 -16 9 -15 4 -17Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M5 -18 C10 -20 14 -21 17 -21" className="konoha-leaf-vein" />
    </g>}

    {variety === "breadfruit" && <g>
      <path d="M0 -14 C10 -14 16 -8 17 1 C18 11 10 18 0 19 C-10 18 -18 11 -17 1 C-16 -8 -10 -14 0 -14Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth=".85" className="konoha-glass-shell" />
      <path d="M0 -13 C-9 -12 -14 -7 -15 1 C-15 9 -9 15 0 17 C-4 8 -4 -3 0 -13Z" fill={depth} className="konoha-glass-depth" />
      <ellipse cx="3" cy="3" rx="11" ry="10" fill={bloom} className="konoha-glass-bloom" />
      <path d="M-10 -5 L-5 -8 L0 -4 L5 -8 L10 -4 L8 2 L13 6 L8 11 L3 10 L0 16 L-5 11 L-11 12 L-12 5 L-7 1Z"
        fill={`url(#${uid}-geode-core)`} className="konoha-geode-core" />
      <path d="M-11 -5 L-5 -1 L-7 4 L-2 7 L-5 12 M-5 -1 L0 -4 L4 0 L9 -3 M-2 7 L3 5 L8 11 M4 0 L3 5 L9 7 L13 5"
        fill="none" stroke={facets} strokeWidth=".65" strokeLinecap="round" className="konoha-geode-cracks" />
      <path d="M-11 -7 C-15 -3 -15 3 -12 6" className="konoha-glass-highlight" />
      <path d="M0 -12 C-5 -12 -9 -16 -10 -19 C-5 -19 -2 -17 0 -14 C2 -18 6 -20 10 -18 C8 -14 5 -12 0 -12Z"
        fill={metal} stroke="#805a1b" strokeWidth=".35" className="konoha-gilt-calyx" />
      <path d="M0 -14 C-2 -20 0 -24 3 -27" stroke={metal} className="konoha-gilt-stem" />
      <path d="M3 -23 C8 -28 15 -26 18 -23 C14 -18 9 -18 4 -20Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M5 -21 C10 -23 14 -24 17 -23" className="konoha-leaf-vein" />
    </g>}

    {variety === "dragon-fruit" && <g>
      <path d="M0 -12 C-7 -12 -12 -5 -12 4 C-12 13 -6 21 0 25 C6 21 12 13 12 4 C12 -5 7 -12 0 -12Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth=".85" className="konoha-glass-shell" />
      <path d="M0 -11 C-6 -10 -10 -4 -10 4 C-10 12 -6 18 0 23 C-3 13 -3 1 0 -11Z" fill={depth} className="konoha-glass-depth" />
      <ellipse cx="2" cy="6" rx="8" ry="11" fill={bloom} className="konoha-glass-bloom" />
      <path d="M0 -10 C-4 -3 -6 6 -5 16 L0 24 L5 16 C6 6 4 -3 0 -10Z M-5 5 L0 1 L5 5"
        fill="none" stroke={facets} strokeWidth=".5" className="konoha-crystal-facets" />
      <path d="M-8 -1 C-11 5 -9 12 -6 16" className="konoha-glass-highlight" />
      <path d="M0 -12 C-3 -15 -7 -16 -10 -16 C-8 -12 -5 -10 -2 -9 C-1 -14 0 -18 0 -21 C2 -17 3 -13 2 -9 C6 -10 9 -13 10 -17 C6 -16 3 -15 0 -12Z"
        fill={metal} stroke="#805a1b" strokeWidth=".35" className="konoha-gilt-calyx" />
      <path d="M0 -19 C-2 -24 0 -28 2 -31" stroke={metal} className="konoha-gilt-stem" />
      <path d="M2 -27 C7 -31 14 -30 18 -27 C14 -22 9 -21 3 -24Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M4 -25 C9 -27 13 -28 17 -27" className="konoha-leaf-vein" />
    </g>}

    {variety === "jatropha-curcas" && <g>
      <path d="M-1 -17 C-3 -22 -1 -25 1 -28 M-1 -17 Q-8 -13 -10 -6 M-1 -17 Q7 -15 9 -8 M-1 -15 Q0 -7 1 -2"
        stroke={metal} className="konoha-gilt-stem konoha-gilt-branch" />
      <path d="M0 -24 C-7 -29 -14 -28 -18 -24 C-13 -18 -7 -18 -1 -21Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M-2 -22 C-8 -24 -13 -25 -17 -24" className="konoha-leaf-vein" />
      <g fill={`url(#${fill})`} stroke={metal} strokeWidth=".75" className="konoha-crystal-berries">
        <circle cx="-10" cy="2" r="8" />
        <circle cx="9" cy="0" r="8.5" />
        <circle cx="1" cy="14" r="9" />
      </g>
      <path d="M-10 -6 A8 8 0 0 0 -10 10 C-13 5 -14 -1 -10 -6Z M9 -8 A8.5 8.5 0 0 0 9 8 C6 3 6 -3 9 -8Z M1 5 A9 9 0 0 0 1 23 C-3 18 -3 10 1 5Z"
        fill={depth} className="konoha-glass-depth" />
      <g fill={bloom} className="konoha-glass-bloom"><circle cx="-7" cy="1" r="4.7" /><circle cx="12" cy="-1" r="5" /><circle cx="4" cy="13" r="5.3" /></g>
      <path d="M-14 -2 C-16 1 -15 5 -13 7 M4 -4 C2 -1 3 3 5 5 M-5 10 C-7 14 -5 18 -3 20" className="konoha-glass-highlight" />
    </g>}

    {variety === "nikkori-pear" && <g>
      <path d="M0 -9 C-7 -13 -14 -7 -15 2 C-16 11 -9 19 0 24 C9 19 16 11 15 2 C14 -7 7 -13 0 -9Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth=".9" className="konoha-glass-shell" />
      <path d="M0 -8 C-7 -10 -12 -5 -13 2 C-14 10 -8 17 0 22 C-3 12 -4 1 0 -8Z" fill={depth} className="konoha-glass-depth" />
      <ellipse cx="3" cy="6" rx="9.5" ry="11" fill={bloom} className="konoha-glass-bloom" />
      <path d="M0 -7 C-5 -4 -8 2 -8 10 L0 23 L8 10 C8 2 5 -4 0 -7Z M-8 10 L0 5 L8 10"
        fill="none" stroke={facets} strokeWidth=".5" className="konoha-crystal-facets" />
      <path d="M-10 0 C-13 6 -11 12 -7 16" className="konoha-glass-highlight" />
      <g fill={metal} stroke="#7d5719" strokeWidth=".42" strokeLinejoin="round" className="konoha-gilt-calyx">
        <path d="M-14 -3 C-9 -4 -6 -8 -4 -12 C-1 -9 0 -7 0 -4 C3 -9 7 -11 11 -11 C10 -6 7 -3 3 -1 C-3 -3 -8 -2 -14 -3Z" />
      </g>
      <path d="M0 -11 C-2 -18 0 -23 3 -27" stroke={metal} className="konoha-gilt-stem" />
      <path d="M3 -23 C9 -28 16 -26 19 -23 C15 -18 10 -17 4 -20Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".55" className="konoha-gem-leaf" />
      <path d="M5 -21 C11 -23 15 -24 18 -23" className="konoha-leaf-vein" />
    </g>}

    {variety === "jatropha-curcas" ? <g className="konoha-glass-stars konoha-glass-stars--cluster" aria-hidden="true">
      <circle cx="-13" cy="-2" r=".14" /><circle cx="-9" cy="-3" r=".22" /><circle cx="-6" cy="0" r=".12" />
      <circle cx="-14" cy="3" r=".2" /><circle cx="-10" cy="5" r=".12" /><circle cx="-6" cy="6" r=".28" /><circle cx="-12" cy="8" r=".1" />
      <circle cx="6" cy="-4" r=".16" /><circle cx="10" cy="-5" r=".1" /><circle cx="13" cy="-2" r=".25" />
      <circle cx="5" cy="1" r=".12" /><circle cx="9" cy="3" r=".2" /><circle cx="13" cy="4" r=".1" /><circle cx="8" cy="6" r=".3" />
      <circle cx="-3" cy="10" r=".2" /><circle cx="1" cy="8" r=".11" /><circle cx="5" cy="11" r=".26" />
      <circle cx="-4" cy="14" r=".1" /><circle cx="0" cy="15" r=".18" /><circle cx="4" cy="17" r=".12" /><circle cx="-1" cy="20" r=".24" /><circle cx="2" cy="21" r=".1" />
      <circle cx="-9" cy="1" r=".52" className="konoha-glass-star-orb" /><circle cx="10" cy="0" r=".46" className="konoha-glass-star-orb" /><circle cx="2" cy="13" r=".56" className="konoha-glass-star-orb" />
      <path d="M-10 -1V2 M-11.5 .5H-8.5 M10 -2V0 M9 -1H11 M3 11V14 M1.5 12.5H4.5" className="konoha-glass-star-glint" />
    </g> : <g className="konoha-glass-stars" aria-hidden="true">
      <circle cx="-3" cy="-6" r=".12" /><circle cx="2" cy="-6" r=".2" /><circle cx="-7" cy="-3" r=".1" /><circle cx="-1" cy="-3" r=".26" /><circle cx="5" cy="-3" r=".12" />
      <circle cx="-9" cy="0" r=".18" /><circle cx="-5" cy="0" r=".11" /><circle cx="3" cy="0" r=".16" /><circle cx="8" cy="1" r=".28" />
      <circle cx="-7" cy="3" r=".12" /><circle cx="-3" cy="4" r=".2" /><circle cx="5" cy="3" r=".1" /><circle cx="9" cy="4" r=".2" />
      <circle cx="-9" cy="6" r=".1" /><circle cx="-5" cy="7" r=".28" /><circle cx="1" cy="6" r=".12" /><circle cx="7" cy="7" r=".16" />
      <circle cx="-7" cy="10" r=".2" /><circle cx="-1" cy="9" r=".1" /><circle cx="4" cy="10" r=".24" /><circle cx="8" cy="10" r=".1" />
      <circle cx="-6" cy="13" r=".11" /><circle cx="2" cy="13" r=".18" /><circle cx="6" cy="15" r=".12" /><circle cx="-3" cy="16" r=".2" /><circle cx="0" cy="19" r=".1" />
      <circle cx="-2" cy="4" r=".56" className="konoha-glass-star-orb" /><circle cx="5" cy="10" r=".48" className="konoha-glass-star-orb" />
      <path d="M3 1V4 M1.5 2.5H4.5 M-4 10V13 M-5.5 11.5H-2.5" className="konoha-glass-star-glint" />
    </g>}
    {mature && <g className="konoha-gem-dust" aria-hidden="true">
      <circle cx="-6" cy="5" r=".48" /><circle cx="6" cy="11" r=".38" /><circle cx="3" cy="-2" r=".3" />
    </g>}
  </>;
}

export function TreeFruit({ uid, appearance, mature, golden = false, newlyFormed = false, justRipened = false, x, y: hangY }: {
  uid: string; appearance: FruitAppearance; mature: boolean; golden?: boolean; newlyFormed?: boolean; justRipened?: boolean; x: number; y: number;
}) {
  const { variety, tilt, size } = appearance;
  const colors = FRUIT_GLASS_COLORS[variety];
  const scale = (mature ? 1 : .52) * size;
  const y = mature ? 23 : 19;
  const fill = `${uid}-fruit-glass`;

  const visiblyGolden = mature && golden;
  return <g className={`konoha-fruit konoha-fruit--${mature ? "ripe" : "young"}${newlyFormed ? " konoha-fruit--new" : ""}${justRipened ? " konoha-fruit--just-ripe" : ""}${visiblyGolden ? " konoha-fruit--golden" : ""}${visiblyGolden && justRipened ? " konoha-fruit--turning-golden" : ""}`} data-fruit-variety={variety} data-golden={visiblyGolden || undefined}
    transform={`translate(${x} ${y + hangY}) rotate(${tilt}) scale(${scale})`}>
    <defs>
      <radialGradient id={fill} cx="43%" cy="42%" r="72%" fx="36%" fy="30%">
        <stop stopColor={colors.light} stopOpacity=".99" />
        <stop offset=".18" stopColor={colors.glow} stopOpacity=".95" />
        <stop offset=".48" stopColor={colors.mid} stopOpacity=".88" />
        <stop offset=".76" stopColor={colors.edge} stopOpacity=".84" />
        <stop offset="1" stopColor={colors.shadow} stopOpacity=".94" />
      </radialGradient>
      <linearGradient id={`${uid}-glass-depth`} x1="0" y1="0" x2="1" y2=".35">
        <stop stopColor={colors.shadow} stopOpacity=".62" /><stop offset=".58" stopColor={colors.edge} stopOpacity=".16" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${uid}-glass-bloom`} cx=".5" cy=".5" r=".55">
        <stop stopColor="#fffef0" stopOpacity=".98" /><stop offset=".22" stopColor="#fff3ae" stopOpacity=".82" />
        <stop offset=".62" stopColor="#ffd879" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-geode-core`} cx=".46" cy=".48" r=".68">
        <stop stopColor="#fffbe0" /><stop offset=".3" stopColor={colors.glow} stopOpacity=".92" />
        <stop offset=".64" stopColor={colors.mid} stopOpacity=".58" /><stop offset="1" stopColor={colors.edge} stopOpacity=".08" />
      </radialGradient>
      <linearGradient id={`${uid}-gilt`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff0a7" /><stop offset=".18" stopColor="#d9a331" /><stop offset=".46" stopColor="#8f5b13" />
        <stop offset=".7" stopColor="#f3c755" /><stop offset="1" stopColor="#6d4411" />
      </linearGradient>
      <linearGradient id={`${uid}-facet-light`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fffde6" stopOpacity=".94" /><stop offset=".45" stopColor="#ffe69c" stopOpacity=".72" />
        <stop offset="1" stopColor={colors.glint} stopOpacity=".62" />
      </linearGradient>
      <linearGradient id={`${uid}-gem-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#9bae69" /><stop offset=".42" stopColor="#59764d" /><stop offset="1" stopColor="#29483c" />
      </linearGradient>
      <filter id={`${uid}-golden-fruit`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values=".45 .55 .12 0 .08  .23 .4 .08 0 .035  .04 .08 .02 0 0  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="gamma" amplitude="1.08" exponent=".82" offset=".02" />
          <feFuncG type="gamma" amplitude="1" exponent=".9" offset=".01" />
          <feFuncB type="gamma" amplitude=".72" exponent="1.08" offset="0" />
        </feComponentTransfer>
      </filter>
    </defs>

    {newlyFormed && <g className="konoha-new-fruit-emphasis" aria-hidden="true">
      <ellipse className="konoha-new-fruit-halo" cx="0" cy="1" rx="18" ry="19" />
      <path className="konoha-new-fruit-glint" d="M0 -23V-16 M-3.5 -19.5H3.5 M18 -12V-7 M15.5 -9.5H20.5" />
    </g>}
    {justRipened && <g className="konoha-just-ripe-celebration" aria-hidden="true">
      <ellipse className="konoha-just-ripe-flash" cx="0" cy="1" rx="19" ry="20" />
      <ellipse className="konoha-just-ripe-ring konoha-just-ripe-ring--one" cx="0" cy="1" rx="20" ry="21" />
      <ellipse className="konoha-just-ripe-ring konoha-just-ripe-ring--two" cx="0" cy="1" rx="24" ry="25" />
      <path className="konoha-just-ripe-burst" d="M0 -29V-21 M0 23V31 M-28 1H-20 M20 1H28 M-20 -19L-14 -13 M14 15L20 21 M20 -19L14 -13 M-14 15L-20 21" />
      <g className="konoha-just-ripe-sparks">
        <circle cx="-25" cy="-12" r="2.1" /><circle cx="24" cy="-15" r="1.7" />
        <circle cx="29" cy="8" r="2" /><circle cx="-28" cy="11" r="1.6" />
        <circle cx="-14" cy="27" r="1.8" /><circle cx="15" cy="28" r="1.4" />
      </g>
    </g>}
    {mature && <ellipse className="konoha-ripe-aura" cx="0" cy="1" rx="20" ry="21" />}
    <g className="konoha-fruit-color konoha-fruit-color--base">
      <FruitArtwork uid={uid} variety={variety} mature={mature} fill={fill} />
    </g>
    {visiblyGolden && <g className="konoha-fruit-color konoha-fruit-color--golden" filter={`url(#${uid}-golden-fruit)`}>
      <FruitArtwork uid={uid} variety={variety} mature={mature} fill={fill} />
    </g>}
    {mature && <path className="konoha-ripe-sparkles" aria-hidden="true"
      d="M-18 -10V-4 M-21 -7H-15 M17 -3V3 M14 0H20 M-12 15V19 M-14 17H-10" />}
  </g>;
}
