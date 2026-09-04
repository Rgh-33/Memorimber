import type { FruitAppearance } from "@/lib/tree-fruit-layout";

export function TreeFruit({ uid, appearance, mature, newlyFormed = false, justRipened = false, x, y: hangY }: {
  uid: string; appearance: FruitAppearance; mature: boolean; newlyFormed?: boolean; justRipened?: boolean; x: number; y: number;
}) {
  const { variety, tilt, size } = appearance;
  const scale = (mature ? 1 : .52) * size;
  const y = mature ? 23 : 19;
  const fill = `${uid}-${variety}`;

  return <g className={`konoha-fruit konoha-fruit--${mature ? "ripe" : "young"}${newlyFormed ? " konoha-fruit--new" : ""}${justRipened ? " konoha-fruit--just-ripe" : ""}`} data-fruit-variety={variety}
    transform={`translate(${x} ${y + hangY}) rotate(${tilt}) scale(${scale})`}>
    <defs>
      <radialGradient id={`${uid}-le-lectier`} cx=".3" cy=".22" r=".82">
        <stop stopColor="#f6dc84" /><stop offset=".45" stopColor="#d9ae4f" /><stop offset=".78" stopColor="#a87935" /><stop offset="1" stopColor="#6f4f27" />
      </radialGradient>
      <radialGradient id={`${uid}-apple`} cx=".3" cy=".2" r=".82">
        <stop stopColor="#ffd37b" /><stop offset=".3" stopColor="#d96642" /><stop offset=".72" stopColor="#a92f2f" /><stop offset="1" stopColor="#692a27" />
      </radialGradient>
      <radialGradient id={`${uid}-breadfruit`} cx=".3" cy=".2" r=".85">
        <stop stopColor="#d6d87d" /><stop offset=".45" stopColor="#8ba653" /><stop offset="1" stopColor="#405f39" />
      </radialGradient>
      <radialGradient id={`${uid}-dragon-fruit`} cx=".32" cy=".18" r=".84">
        <stop stopColor="#ffabc0" /><stop offset=".34" stopColor="#f14f87" /><stop offset=".72" stopColor="#cf286d" /><stop offset="1" stopColor="#861f50" />
      </radialGradient>
      <linearGradient id={`${uid}-dragon-bract`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#e63e79" /><stop offset=".48" stopColor="#d53270" /><stop offset=".58" stopColor="#a8c85e" /><stop offset="1" stopColor="#4f8248" />
      </linearGradient>
      <radialGradient id={`${uid}-jatropha-curcas`} cx=".35" cy=".22" r=".84">
        <stop stopColor="#e1db79" /><stop offset=".48" stopColor="#91a957" /><stop offset="1" stopColor="#4f6538" />
      </radialGradient>
      <radialGradient id={`${uid}-nikkori-pear`} cx=".32" cy=".2" r=".85">
        <stop stopColor="#f4d67d" /><stop offset=".48" stopColor="#c79a42" /><stop offset="1" stopColor="#79532b" />
      </radialGradient>
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
    <path d="M0 -15 Q-1 -11 1 -8" fill="none" stroke="#5b4a2d" strokeWidth="2" strokeLinecap="round" />

    {variety === "le-lectier" && <>
      <path d="M0 -11 C-5 -10 -5 -5 -7 -2 C-12 3 -12 10 -7 13 C-3 16 5 16 9 12 C13 8 11 2 7 -2 C4 -5 5 -10 0 -11Z" fill={`url(#${fill})`} stroke="#75532d" strokeWidth=".8" />
      <path d="M-4 -6 C-7 0 -8 8 -4 11" fill="none" stroke="#fff1b0" strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
      {mature && <g fill="#76532f" opacity=".63"><circle cx="4" cy="-3" r=".65" /><circle cx="7" cy="4" r=".55" /><circle cx="3" cy="10" r=".7" /><circle cx="-1" cy="6" r=".5" /><circle cx="8" cy="8" r=".4" /></g>}
    </>}

    {variety === "apple" && <>
      <path d="M0 -8 C-4 -12 -12 -9 -13 -1 C-15 8 -8 14 0 12 C8 15 15 8 13 -1 C12 -9 5 -12 0 -8Z" fill={`url(#${fill})`} stroke="#78302b" strokeWidth=".8" />
      <path d="M1 -9 Q7 -15 13 -10 Q7 -6 2 -7Z" fill="#708747" stroke="#435f3b" strokeWidth=".6" />
      <path d="M-8 -4 Q-11 3 -7 8" fill="none" stroke="#ffe0a0" strokeWidth="2.4" strokeLinecap="round" opacity=".53" />
    </>}

    {variety === "breadfruit" && <>
      <path d="M0 -12 C-9 -12 -14 -4 -13 4 C-12 13 -5 16 2 15 C11 14 15 7 13 -2 C12 -10 6 -13 0 -12Z" fill={`url(#${fill})`} stroke="#47623b" strokeWidth=".8" />
      {mature && <g fill="none" stroke="#d9d787" strokeWidth=".65" opacity=".72">
        <path d="M-8 -6 l4 -2 4 2 -1 4 -4 1 -3 -2Z M2 -8 l4 -1 3 3 -2 4 -4 1 -3 -3Z M-10 2 l4 -2 3 3 -1 4 -4 1 -3 -3Z M0 1 l4 -2 4 3 -1 4 -4 2 -4 -3Z M-5 9 l4 -2 4 2 -1 4 -4 1Z M7 7 l3 -2 2 3 -2 3 -3 1Z" />
      </g>}
      <path d="M-7 -7 Q-10 -1 -9 4" fill="none" stroke="#f1ecac" strokeWidth="2" strokeLinecap="round" opacity=".42" />
    </>}

    {variety === "dragon-fruit" && <>
      <path d="M0 -13 C-8 -14 -13 -7 -12 1 C-13 9 -8 15 -1 16 C7 17 12 12 12 3 C13 -5 8 -12 0 -13Z" fill={`url(#${fill})`} stroke="#8f2354" strokeWidth=".85" />
      <g fill={`url(#${uid}-dragon-bract)`} stroke="#477842" strokeWidth=".48" strokeLinejoin="round">
        <path d="M-3 -11 C-7 -15 -7 -19 -5 -21 C-1 -17 1 -14 2 -11Z" />
        <path d="M-8 -8 C-13 -10 -15 -13 -14 -16 C-10 -13 -6 -12 -4 -9Z" />
        <path d="M6 -9 C11 -12 14 -13 15 -11 C12 -7 9 -5 7 -4Z" />
        <path d="M-11 -2 C-16 -3 -18 -6 -18 -9 C-14 -7 -10 -6 -7 -3Z" />
        <path d="M10 -1 C15 -4 18 -4 19 -1 C15 2 12 3 9 3Z" />
        <path d="M-10 6 C-15 7 -17 5 -18 3 C-14 2 -10 1 -7 2Z" />
        <path d="M9 7 C14 5 17 7 18 9 C14 11 10 11 7 10Z" />
        <path d="M-5 12 C-8 16 -7 20 -5 21 C-2 18 -1 15 0 13Z" />
        <path d="M3 13 C5 18 8 19 10 17 C8 13 6 11 4 10Z" />
      </g>
      <path d="M-7 -7 Q-10 0 -7 8" fill="none" stroke="#ffd7e2" strokeWidth="2.2" strokeLinecap="round" opacity=".58" />
      <path d="M1 -10 Q5 -7 7 -3" fill="none" stroke="#ffb1c8" strokeWidth=".8" opacity=".55" />
    </>}

    {variety === "jatropha-curcas" && <>
      <g fill={`url(#${fill})`} stroke="#52673a" strokeWidth=".7">
        <path d="M0 -9 C-7 -11 -10 -5 -8 1 C-7 6 -3 8 0 5 C3 8 7 6 8 1 C10 -5 6 -11 0 -9Z" />
        <path d="M0 1 C-6 -1 -10 4 -8 9 C-6 14 -2 15 0 11 C3 15 8 13 9 8 C10 3 6 -1 0 1Z" />
      </g>
      <path d="M0 -7 L0 11 M-6 0 Q0 3 6 0" fill="none" stroke="#e5de88" strokeWidth=".75" opacity=".65" />
      <path d="M-5 -6 Q-8 -2 -6 2" fill="none" stroke="#f1efb3" strokeWidth="1.7" strokeLinecap="round" opacity=".45" />
    </>}

    {variety === "nikkori-pear" && <>
      <path d="M0 -10 C-8 -12 -14 -5 -14 4 C-14 13 -7 17 1 16 C10 16 15 10 14 2 C13 -6 7 -11 0 -10Z" fill={`url(#${fill})`} stroke="#76512b" strokeWidth=".8" />
      <path d="M-8 -6 Q-12 1 -9 8" fill="none" stroke="#ffedaa" strokeWidth="2.5" strokeLinecap="round" opacity=".48" />
      {mature && <g fill="#74512f" opacity=".55"><circle cx="4" cy="-4" r=".55" /><circle cx="8" cy="1" r=".6" /><circle cx="5" cy="9" r=".45" /><circle cx="-1" cy="12" r=".6" /><circle cx="-4" cy="4" r=".45" /><circle cx="10" cy="7" r=".45" /></g>}
    </>}
    {mature && <path className="konoha-ripe-sparkles" aria-hidden="true"
      d="M-18 -10V-4 M-21 -7H-15 M17 -3V3 M14 0H20 M-12 15V19 M-14 17H-10" />}
  </g>;
}
