import { useId } from "react";
import { WORDMARK_STRIPS, WORDMARK_WIDTH } from "@/lib/tea-wordmark-geometry";

export function TeaWordmark() {
  const id = useId();
  return (
    <svg className="tea-cup-brand" viewBox="-70 -24 140 40" aria-hidden="true" focusable="false">
      <defs>
        <text id={`${id}-ink`} x={-WORDMARK_WIDTH / 2} y="0" textLength={WORDMARK_WIDTH} lengthAdjust="spacingAndGlyphs">memorimber</text>
        {WORDMARK_STRIPS.map((strip, index) => (
          <clipPath key={index} id={`${id}-strip-${index}`} clipPathUnits="userSpaceOnUse">
            <rect x={strip.left - .025} y="-24" width={strip.width + .05} height="40" />
          </clipPath>
        ))}
      </defs>
      {WORDMARK_STRIPS.map((strip, index) => (
        <g key={index} transform={`matrix(${strip.matrix.join(" ")})`}>
          <use href={`#${id}-ink`} clipPath={`url(#${id}-strip-${index})`} />
        </g>
      ))}
    </svg>
  );
}
