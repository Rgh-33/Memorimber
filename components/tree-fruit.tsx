import type { FruitAppearance } from "@/lib/tree-fruit-layout";

export function TreeFruit({ uid, appearance, mature, x, y: hangY }: {
  uid: string; appearance: FruitAppearance; mature: boolean; x: number; y: number;
}) {
  const { variety, tilt, size } = appearance;
  const scale = (mature ? 1 : .52) * size;
  const y = mature ? 23 : 19;
  const fill = `${uid}-${variety}`;

  return <g className={`konoha-fruit konoha-fruit--${mature ? "ripe" : "young"}`} data-fruit-variety={variety}
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
        <stop stopColor="#ff9ab2" /><stop offset=".42" stopColor="#e94c7d" /><stop offset="1" stopColor="#9c2857" />
      </radialGradient>
      <radialGradient id={`${uid}-jatropha-curcas`} cx=".35" cy=".22" r=".84">
        <stop stopColor="#e1db79" /><stop offset=".48" stopColor="#91a957" /><stop offset="1" stopColor="#4f6538" />
      </radialGradient>
      <radialGradient id={`${uid}-nikkori-pear`} cx=".32" cy=".2" r=".85">
        <stop stopColor="#f4d67d" /><stop offset=".48" stopColor="#c79a42" /><stop offset="1" stopColor="#79532b" />
      </radialGradient>
    </defs>

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
      <path d="M0 -12 C-8 -13 -12 -6 -11 3 C-10 12 -5 16 1 15 C8 15 12 9 11 1 C11 -7 7 -12 0 -12Z" fill={`url(#${fill})`} stroke="#922a57" strokeWidth=".8" />
      <g fill="#7ea553" stroke="#4e7546" strokeWidth=".45">
        <path d="M-4 -10 Q-9 -15 -8 -7Z M4 -10 Q10 -14 7 -6Z M-9 -4 Q-15 -5 -10 1Z M9 -2 Q15 -5 10 3Z M-9 6 Q-14 8 -7 10Z M8 7 Q14 10 7 11Z M-2 14 Q0 20 3 14Z" />
      </g>
      <path d="M-6 -6 Q-9 1 -6 7" fill="none" stroke="#ffd0d9" strokeWidth="2" strokeLinecap="round" opacity=".48" />
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
  </g>;
}
