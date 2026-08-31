import { useId } from "react";

// An uneven petal with fine fibres. Keep the texture off its crisp lettering.
const PETAL = "M10 73 C19 64 16 51 30 34 C42 19 64 11 85 15 C101 18 115 9 132 13 C147 14 159 22 165 34 L158 38 C169 41 172 52 166 63 C155 83 136 90 115 85 C92 80 73 89 53 85 C33 81 23 78 10 73Z";

export function MemoryPetal({ className = "konoha-word-petal" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return <svg className={className} viewBox="0 0 180 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${uid}-petal`} x1="0" y1=".8" x2=".8" y2=".2">
        <stop stopColor="var(--konoha-petal-edge)" />
        <stop offset=".38" stopColor="var(--konoha-petal-fill)" />
        <stop offset="1" stopColor="var(--konoha-petal-light)" />
      </linearGradient>
      <filter id={`${uid}-fibre`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".12 .7" numOctaves="2" seed="17" result="grain" />
        <feColorMatrix in="grain" type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="linear" slope=".16" /></feComponentTransfer>
        <feBlend in="SourceGraphic" mode="multiply" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <clipPath id={`${uid}-clip`}><path d={PETAL} /></clipPath>
    </defs>
    <g filter={`url(#${uid}-fibre)`}>
      <path className="konoha-petal-body" d={PETAL} fill={`url(#${uid}-petal)`} />
      <g clipPath={`url(#${uid}-clip)`} fill="none" stroke="var(--konoha-petal-edge)" strokeLinecap="round">
        <path d="M13 73 C49 67 81 48 149 24 M18 72 C59 69 111 57 170 48 M18 75 C63 77 116 75 160 68" strokeWidth="1.6" opacity=".13" />
        <path d="M20 72 Q32 44 57 23 M25 72 Q49 35 85 19 M28 73 Q72 48 114 22 M34 73 Q82 67 147 36 M24 75 Q87 89 127 80" strokeWidth=".5" opacity=".26" />
        <path d="M27 71 Q56 32 86 21 M33 74 Q101 59 162 46 M36 77 Q104 78 148 69" stroke="var(--konoha-petal-light)" strokeWidth=".65" opacity=".35" />
      </g>
      <path className="konoha-word-petal-fold" d="M10 73 Q30 70 48 78 C66 86 92 78 115 85 C88 84 70 91 53 85 Q28 81 10 73Z" fill="var(--konoha-petal-fold)" opacity=".58" />
      <path d="M158 38 Q163 48 166 63 Q168 51 172 48 Q169 41 158 38Z" fill="var(--konoha-petal-fold)" opacity=".6" />
    </g>
  </svg>;
}
