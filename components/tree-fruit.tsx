import type { FruitAppearance } from "@/lib/tree-fruit-layout";

function FruitArtwork({ uid, variety, mature, fill }: {
  uid: string;
  variety: FruitAppearance["variety"];
  mature: boolean;
  fill: string;
}) {
  const metal = `url(#${uid}-gilt)`;
  const facets = `url(#${uid}-facet-light)`;

  return <>
    {variety === "le-lectier" && <g>
      <path d="M0 -13 L-7 -8 L-13 2 L-12 11 L-6 17 L0 22 L6 17 L12 11 L13 2 L7 -8Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth="1.15" strokeLinejoin="round" className="konoha-glass-shell" />
      <path d="M0 -13 L-7 -8 L-13 2 L-12 11 L0 22 L0 5 L-6 1Z" fill={`url(#${fill})`} className="konoha-crystal-side" />
      <path d="M0 5 L0 22 L12 11 L13 2 L6 1Z" fill={`url(#${fill})`} className="konoha-crystal-front" />
      <path d="M0 -13 L-7 -8 L-6 1 L0 5 L6 1 L7 -8Z" fill={`url(#${fill})`} className="konoha-crystal-top" />
      <path d="M0 -12 L-7 -8 L-6 1 L0 5 L6 1 L7 -8Z M-6 1 L-5 12 L0 21 L0 5Z"
        fill={`url(#${uid}-glass-heart)`} className="konoha-crystal-planes" />
      <path d="M0 -12 L-6 1 L-5 12 L0 21 L5 12 L6 1Z M-6 1 L0 5 L6 1 M-5 12 L0 5 L5 12"
        fill="none" stroke={facets} strokeWidth=".72" strokeLinejoin="round" className="konoha-crystal-facets" />
      <path d="M-7 2 Q-9 8 -5 13" className="konoha-glass-highlight" />
      <path d="M0 -12 C-5 -13 -8 -17 -8 -20 C-3 -20 0 -17 1 -13 C3 -18 7 -20 10 -19 C9 -15 6 -12 0 -12Z"
        fill={metal} stroke="#7f5817" strokeWidth=".45" strokeLinejoin="round" className="konoha-gilt-calyx" />
      <path d="M0 -16 C-2 -22 1 -25 3 -27" className="konoha-gilt-stem" />
      <path d="M3 -24 C8 -29 15 -29 19 -27 C16 -21 10 -19 4 -21Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M5 -22 Q11 -25 17 -27" className="konoha-leaf-vein" />
    </g>}

    {variety === "apple" && <g>
      <path d="M0 -8 L-6 -12 L-13 -10 L-17 -3 L-15 6 L-9 13 L0 19 L9 13 L15 6 L17 -3 L13 -10 L6 -12Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth="1.2" strokeLinejoin="round" className="konoha-glass-shell" />
      <path d="M0 -8 L-6 -12 L-13 -10 L-17 -3 L-15 6 L0 19 L0 2 L-8 -3Z" fill={`url(#${fill})`} className="konoha-crystal-side" />
      <path d="M0 2 L0 19 L15 6 L17 -3 L8 -3Z" fill={`url(#${fill})`} className="konoha-crystal-front" />
      <path d="M0 -8 L-6 -12 L-13 -10 L-8 -3 L0 2 L8 -3 L13 -10 L6 -12Z" fill={`url(#${fill})`} className="konoha-crystal-top" />
      <path d="M0 -8 L-8 -3 L0 2 L8 -3 L6 -11Z M-8 -3 L-10 8 L0 18 L0 2Z"
        fill={`url(#${uid}-glass-heart)`} className="konoha-crystal-planes" />
      <path d="M0 -8 L-8 -3 L-10 8 L0 18 L10 8 L8 -3Z M-8 -3 L0 2 L8 -3 M-10 8 L0 2 L10 8"
        fill="none" stroke={facets} strokeWidth=".72" strokeLinejoin="round" className="konoha-crystal-facets" />
      <path d="M-10 -3 Q-13 3 -9 8" className="konoha-glass-highlight" />
      <path d="M0 -9 C-5 -10 -8 -14 -8 -17 C-3 -17 0 -14 1 -10 C3 -14 7 -17 10 -16 C9 -12 6 -9 0 -9Z"
        fill={metal} stroke="#805a1b" strokeWidth=".45" className="konoha-gilt-calyx" />
      <path d="M0 -12 C-1 -18 1 -22 4 -24" className="konoha-gilt-stem" />
      <path d="M3 -20 C8 -25 14 -24 18 -21 C14 -16 9 -15 4 -17Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M5 -18 Q11 -21 16 -21" className="konoha-leaf-vein" />
    </g>}

    {variety === "breadfruit" && <g>
      <path d="M0 -13 L8 -11 L13 -6 L16 2 L14 10 L8 16 L0 19 L-8 16 L-14 10 L-16 2 L-13 -6 L-7 -11Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth="1.15" strokeLinejoin="round" className="konoha-glass-shell" />
      <path d="M0 -13 L-7 -11 L-13 -6 L-16 2 L-14 10 L0 19 L0 3 L-5 -1Z" fill={`url(#${fill})`} className="konoha-crystal-side" />
      <path d="M0 3 L0 19 L8 16 L14 10 L16 2 L6 -1Z" fill={`url(#${fill})`} className="konoha-crystal-front" />
      <path d="M0 -13 L-7 -11 L-5 -1 L0 3 L6 -1 L8 -11Z" fill={`url(#${fill})`} className="konoha-crystal-top" />
      <path d="M-10 -5 L-5 -8 L0 -4 L5 -8 L10 -4 L8 2 L13 6 L8 11 L3 10 L0 16 L-5 11 L-11 12 L-12 5 L-7 1Z"
        fill={`url(#${uid}-geode-core)`} className="konoha-geode-core" />
      <path d="M-11 -5 L-5 -1 L-7 4 L-2 7 L-5 12 M-5 -1 L0 -4 L4 0 L9 -3 M-2 7 L3 5 L8 11 M4 0 L3 5 L9 7 L13 5"
        fill="none" stroke={facets} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="konoha-geode-cracks" />
      <path d="M-10 -7 Q-14 -2 -12 4" className="konoha-glass-highlight" />
      <path d="M0 -12 C-5 -12 -9 -16 -10 -19 C-5 -19 -2 -17 0 -14 C2 -18 6 -20 10 -18 C8 -14 5 -12 0 -12Z"
        fill={metal} stroke="#805a1b" strokeWidth=".45" className="konoha-gilt-calyx" />
      <path d="M0 -14 C-2 -20 0 -24 3 -26" className="konoha-gilt-stem" />
      <path d="M3 -23 C8 -28 15 -26 18 -23 C14 -18 9 -18 4 -20Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M5 -21 Q11 -24 16 -24" className="konoha-leaf-vein" />
    </g>}

    {variety === "dragon-fruit" && <g>
      <path d="M0 -12 L-7 -9 L-13 -1 L-11 12 L-5 20 L0 24 L6 19 L12 10 L13 -2 L7 -9Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth="1.15" strokeLinejoin="round" className="konoha-glass-shell" />
      <path d="M0 -12 L-7 -9 L-13 -1 L-11 12 L0 24 L0 5 L-6 0Z" fill={`url(#${fill})`} className="konoha-crystal-side" />
      <path d="M0 5 L0 24 L6 19 L12 10 L13 -2 L6 0Z" fill={`url(#${fill})`} className="konoha-crystal-front" />
      <path d="M0 -12 L-7 -9 L-6 0 L0 5 L6 0 L7 -9Z" fill={`url(#${fill})`} className="konoha-crystal-top" />
      <path d="M0 -11 L-6 0 L0 5 L6 0Z M-6 0 L-5 13 L0 23 L0 5 M6 0 L5 12 L0 23"
        fill="none" stroke={facets} strokeWidth=".72" strokeLinejoin="round" className="konoha-crystal-facets" />
      <path d="M-8 0 Q-10 7 -7 12" className="konoha-glass-highlight" />
      <path d="M0 -12 L-7 -13 L-10 -17 L-3 -16 L0 -21 L3 -16 L10 -17 L7 -13Z"
        fill={metal} stroke="#805a1b" strokeWidth=".45" strokeLinejoin="round" className="konoha-gilt-calyx" />
      <path d="M0 -19 C-2 -24 0 -28 2 -30" className="konoha-gilt-stem" />
      <path d="M2 -27 C7 -31 14 -30 18 -27 C14 -22 9 -21 3 -24Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M4 -25 Q10 -28 16 -28" className="konoha-leaf-vein" />
    </g>}

    {variety === "jatropha-curcas" && <g>
      <path d="M-1 -17 C-3 -22 -1 -25 1 -28 M-1 -17 Q-8 -13 -10 -6 M-1 -17 Q7 -15 9 -8 M-1 -15 Q0 -7 1 -2"
        className="konoha-gilt-stem konoha-gilt-branch" />
      <path d="M0 -24 C-7 -29 -14 -28 -18 -24 C-13 -18 -7 -18 -1 -21Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M-2 -22 Q-8 -24 -16 -25" className="konoha-leaf-vein" />
      <g fill={`url(#${fill})`} stroke={metal} strokeWidth="1" strokeLinejoin="round" className="konoha-crystal-berries">
        <path d="M-9 -7 L-3 -3 L-3 5 L-9 11 L-16 6 L-16 -2Z" />
        <path d="M9 -10 L16 -5 L16 4 L9 10 L2 5 L2 -5Z" />
        <path d="M1 3 L8 8 L8 18 L1 23 L-7 18 L-7 8Z" />
      </g>
      <g fill={`url(#${fill})`}>
        <path d="M-9 -7 L-16 -2 L-16 6 L-9 11 L-9 2Z" className="konoha-crystal-side" />
        <path d="M9 -10 L2 -5 L2 5 L9 10 L9 0Z" className="konoha-crystal-side" />
        <path d="M1 3 L-7 8 L-7 18 L1 23 L1 13Z" className="konoha-crystal-side" />
        <path d="M-9 -7 L-3 -3 L-9 2 L-16 -2Z M9 -10 L16 -5 L9 0 L2 -5Z M1 3 L8 8 L1 13 L-7 8Z" className="konoha-crystal-top" />
      </g>
      <path d="M-15 -4 L-9 -7 L-9 2 L-3 -5 M3 -7 L9 -10 L9 0 L16 -7 M-6 6 L1 3 L1 13 L8 6"
        fill="none" stroke={facets} strokeWidth=".55" className="konoha-crystal-planes" />
      <path d="M-15 -2 L-9 2 L-4 -3 M3 -4 L9 0 L14 -4 M-6 10 L1 13 L7 8"
        fill="none" stroke={facets} strokeWidth=".65" className="konoha-crystal-facets" />
      <path d="M-14 -3 Q-17 1 -14 5 M4 -5 Q1 -1 3 3 M-5 8 Q-7 13 -3 16" className="konoha-glass-highlight" />
    </g>}

    {variety === "nikkori-pear" && <g>
      <path d="M0 -8 L-7 -10 L-13 -5 L-14 4 L-11 13 L0 22 L11 13 L14 4 L13 -5 L7 -10Z"
        fill={`url(#${fill})`} stroke={metal} strokeWidth="1.2" strokeLinejoin="round" className="konoha-glass-shell" />
      <path d="M0 -8 L-7 -10 L-13 -5 L-14 4 L-11 13 L0 22 L0 5 L-7 1Z" fill={`url(#${fill})`} className="konoha-crystal-side" />
      <path d="M0 5 L0 22 L11 13 L14 4 L7 1Z" fill={`url(#${fill})`} className="konoha-crystal-front" />
      <path d="M0 -8 L-7 -10 L-7 1 L0 5 L7 1 L7 -10Z" fill={`url(#${fill})`} className="konoha-crystal-top" />
      <path d="M0 -7 L-7 1 L0 5 L7 1 L7 -9Z M-7 1 L-7 12 L0 21 L0 5Z"
        fill={`url(#${uid}-glass-heart)`} className="konoha-crystal-planes" />
      <path d="M0 -7 L-7 1 L-7 12 L0 21 L7 12 L7 1Z M-7 1 L0 5 L7 1 M-7 12 L0 5 L7 12"
        fill="none" stroke={facets} strokeWidth=".72" strokeLinejoin="round" className="konoha-crystal-facets" />
      <path d="M-9 1 Q-11 7 -7 12" className="konoha-glass-highlight" />
      <g fill={metal} stroke="#7d5719" strokeWidth=".42" strokeLinejoin="round" className="konoha-gilt-calyx">
        <path d="M-13 -2 L-7 -11 L-2 -6 L0 -13 L4 -6 L10 -11 L13 -2 L7 2 L0 -3 L-7 2Z" />
      </g>
      <path d="M0 -12 C-2 -19 0 -23 3 -26" className="konoha-gilt-stem" />
      <path d="M3 -23 C9 -28 16 -26 19 -23 C15 -18 10 -17 4 -20Z" fill={`url(#${uid}-gem-leaf)`}
        stroke="#38563d" strokeWidth=".65" className="konoha-gem-leaf" />
      <path d="M5 -21 Q12 -24 17 -24" className="konoha-leaf-vein" />
    </g>}

    {mature && <g className="konoha-gem-dust" aria-hidden="true">
      <circle cx="-5" cy="3" r=".75" /><circle cx="5" cy="9" r=".55" /><circle cx="2" cy="-3" r=".45" />
    </g>}
  </>;
}

export function TreeFruit({ uid, appearance, mature, golden = false, newlyFormed = false, justRipened = false, x, y: hangY }: {
  uid: string; appearance: FruitAppearance; mature: boolean; golden?: boolean; newlyFormed?: boolean; justRipened?: boolean; x: number; y: number;
}) {
  const { variety, tilt, size } = appearance;
  const scale = (mature ? 1 : .52) * size;
  const y = mature ? 23 : 19;
  const fill = `${uid}-${variety}`;

  const visiblyGolden = mature && golden;
  return <g className={`konoha-fruit konoha-fruit--${mature ? "ripe" : "young"}${newlyFormed ? " konoha-fruit--new" : ""}${justRipened ? " konoha-fruit--just-ripe" : ""}${visiblyGolden ? " konoha-fruit--golden" : ""}${visiblyGolden && justRipened ? " konoha-fruit--turning-golden" : ""}`} data-fruit-variety={variety} data-golden={visiblyGolden || undefined}
    transform={`translate(${x} ${y + hangY}) rotate(${tilt}) scale(${scale})`}>
    <defs>
      <linearGradient id={`${uid}-le-lectier`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fffdf0" stopOpacity=".98" /><stop offset=".24" stopColor="#ffd6a3" stopOpacity=".86" /><stop offset=".58" stopColor="#dfaee4" stopOpacity=".76" /><stop offset=".83" stopColor="#9eace1" stopOpacity=".7" /><stop offset="1" stopColor="#656596" stopOpacity=".82" />
      </linearGradient>
      <linearGradient id={`${uid}-apple`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fffce7" stopOpacity=".98" /><stop offset=".28" stopColor="#ffc49d" stopOpacity=".86" /><stop offset=".62" stopColor="#ed91aa" stopOpacity=".74" /><stop offset="1" stopColor="#994c69" stopOpacity=".82" />
      </linearGradient>
      <linearGradient id={`${uid}-breadfruit`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fff9df" stopOpacity=".97" /><stop offset=".25" stopColor="#ddbae6" stopOpacity=".82" /><stop offset=".64" stopColor="#999ad2" stopOpacity=".7" /><stop offset="1" stopColor="#595680" stopOpacity=".84" />
      </linearGradient>
      <linearGradient id={`${uid}-dragon-fruit`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fffde8" stopOpacity=".98" /><stop offset=".26" stopColor="#ffd1ad" stopOpacity=".86" /><stop offset=".62" stopColor="#ee9db5" stopOpacity=".74" /><stop offset="1" stopColor="#a75270" stopOpacity=".82" />
      </linearGradient>
      <linearGradient id={`${uid}-jatropha-curcas`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fffde5" stopOpacity=".98" /><stop offset=".26" stopColor="#bdebd8" stopOpacity=".84" /><stop offset=".62" stopColor="#76c8c7" stopOpacity=".72" /><stop offset="1" stopColor="#40828c" stopOpacity=".84" />
      </linearGradient>
      <linearGradient id={`${uid}-nikkori-pear`} x1=".08" y1="0" x2=".9" y2="1">
        <stop stopColor="#fffde9" stopOpacity=".98" /><stop offset=".3" stopColor="#ead0e4" stopOpacity=".82" /><stop offset=".66" stopColor="#adb5e3" stopOpacity=".7" /><stop offset="1" stopColor="#686991" stopOpacity=".84" />
      </linearGradient>
      <radialGradient id={`${uid}-glass-heart`} cx=".5" cy=".5" r=".54">
        <stop stopColor="#fffde5" stopOpacity=".92" /><stop offset=".27" stopColor="#fff0a8" stopOpacity=".68" />
        <stop offset=".72" stopColor="#ffd86e" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-geode-core`} cx=".46" cy=".48" r=".68">
        <stop stopColor="#fffbe0" /><stop offset=".3" stopColor="#ffd884" stopOpacity=".9" />
        <stop offset=".64" stopColor="#d597d2" stopOpacity=".55" /><stop offset="1" stopColor="#7c72aa" stopOpacity=".08" />
      </radialGradient>
      <linearGradient id={`${uid}-gilt`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff0a7" /><stop offset=".18" stopColor="#d9a331" /><stop offset=".46" stopColor="#8f5b13" />
        <stop offset=".7" stopColor="#f3c755" /><stop offset="1" stopColor="#6d4411" />
      </linearGradient>
      <linearGradient id={`${uid}-facet-light`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fffde6" stopOpacity=".94" /><stop offset=".45" stopColor="#ffe69c" stopOpacity=".72" />
        <stop offset="1" stopColor="#c8ddff" stopOpacity=".52" />
      </linearGradient>
      <linearGradient id={`${uid}-gem-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#9bae69" /><stop offset=".42" stopColor="#59764d" /><stop offset="1" stopColor="#29483c" />
      </linearGradient>
      <filter id={`${uid}-golden-fruit`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values=".32 .5 .1 0 .24  .2 .34 .06 0 .1  .035 .07 .015 0 .01  0 0 0 1 0" />
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
