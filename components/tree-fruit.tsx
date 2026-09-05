import type { FruitAppearance } from "@/lib/tree-fruit-layout";

const FRUIT_ASSET_BY_VARIETY: Record<FruitAppearance["variety"], string> = {
  "le-lectier": "/memory-fruits/memory-drop.svg",
  apple: "/memory-fruits/memory-star.svg",
  breadfruit: "/memory-fruits/memory-geode.svg",
  "dragon-fruit": "/memory-fruits/memory-bloom.svg",
  "jatropha-curcas": "/memory-fruits/memory-cluster.svg",
  "nikkori-pear": "/memory-fruits/memory-moon.svg",
};

function FruitArtwork({ variety }: { variety: FruitAppearance["variety"] }) {
  return <image
    href={FRUIT_ASSET_BY_VARIETY[variety]}
    x="-22"
    y="-18"
    width="44"
    height="44"
    preserveAspectRatio="xMidYMid meet"
    className="konoha-fruit-asset"
    aria-hidden="true"
  />;
}

export function TreeFruit({ uid, appearance, mature, golden = false, newlyFormed = false, justRipened = false, x, y: hangY }: {
  uid: string; appearance: FruitAppearance; mature: boolean; golden?: boolean; newlyFormed?: boolean; justRipened?: boolean; x: number; y: number;
}) {
  const { variety, tilt, size } = appearance;
  const scale = (mature ? 1 : .52) * size;
  const y = mature ? 23 : 19;
  const visiblyGolden = mature && golden;
  return <g className={`konoha-fruit konoha-fruit--${mature ? "ripe" : "young"}${newlyFormed ? " konoha-fruit--new" : ""}${justRipened ? " konoha-fruit--just-ripe" : ""}${visiblyGolden ? " konoha-fruit--golden" : ""}${visiblyGolden && justRipened ? " konoha-fruit--turning-golden" : ""}`} data-fruit-variety={variety} data-golden={visiblyGolden || undefined}
    transform={`translate(${x} ${y + hangY}) rotate(${tilt}) scale(${scale})`}>
    <defs>
      <filter id={`${uid}-golden-fruit`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values=".27 .53 .10 0 .25  .225 .4425 .0825 0 .16  .075 .1475 .0275 0 .02  0 0 0 1 0" />
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
      <FruitArtwork variety={variety} />
    </g>
    {visiblyGolden && <g className="konoha-fruit-color konoha-fruit-color--golden" filter={`url(#${uid}-golden-fruit)`}>
      <FruitArtwork variety={variety} />
    </g>}
    {mature && <path className="konoha-ripe-sparkles" aria-hidden="true"
      d="M-18 -10V-4 M-21 -7H-15 M17 -3V3 M14 0H20 M-12 15V19 M-14 17H-10" />}
  </g>;
}
