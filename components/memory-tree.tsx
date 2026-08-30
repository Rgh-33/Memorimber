import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { MemoryFruitTone, MemoryTreeItem } from "@/lib/tree-data";

const WORD_SLOTS = [
  { left: "2%", top: 4, rotate: -4, opacity: 0.56, scale: 0.9, driftX: 5, delay: -1.2 },
  { left: "69%", top: 38, rotate: 4, opacity: 0.65, scale: 0.94, driftX: -5, delay: -2.7 },
  { left: "10%", top: 106, rotate: -3, opacity: 0.72, scale: 0.98, driftX: 6, delay: -0.5 },
  { left: "73%", top: 142, rotate: 5, opacity: 0.78, scale: 1, driftX: -6, delay: -3.4 },
  { left: "1%", top: 226, rotate: -4, opacity: 0.86, scale: 1.04, driftX: 5, delay: -2 },
  { left: "61%", top: 250, rotate: 3, opacity: 0.92, scale: 1.08, driftX: -5, delay: -4.1 },
] as const;

const FRUIT_SLOTS = [
  { left: "27%", top: "13%" },
  { left: "66%", top: "15%" },
  { left: "49%", top: "29%" },
  { left: "76%", top: "36%" },
  { left: "23%", top: "43%" },
  { left: "66%", top: "47%" },
] as const;

const TONE_CLASS: Record<MemoryFruitTone, string> = {
  blue: "memory-fruit--blue",
  mint: "memory-fruit--mint",
  peach: "memory-fruit--peach",
  lavender: "memory-fruit--lavender",
  lemon: "memory-fruit--lemon",
  rose: "memory-fruit--rose",
};

type SceneStyle = CSSProperties & {
  "--word-opacity"?: number;
  "--word-scale"?: number;
  "--word-rotate"?: string;
  "--word-drift-x"?: string;
  "--float-delay"?: string;
  "--fruit-growth"?: number;
  "--fruit-width"?: string;
  "--fruit-height"?: string;
};

function FloatingWord({ item }: { item: MemoryTreeItem }) {
  const slot = WORD_SLOTS[item.wordSlot ?? 0] ?? WORD_SLOTS[0];
  const style: SceneStyle = {
    left: slot.left,
    top: slot.top,
    "--word-opacity": slot.opacity,
    "--word-scale": slot.scale,
    "--word-rotate": `${slot.rotate}deg`,
    "--word-drift-x": `${slot.driftX}px`,
    "--float-delay": `${slot.delay}s`,
  };

  const content = (
    <>
      <span aria-hidden="true" className="memory-word-particle memory-word-particle--one" />
      <span aria-hidden="true" className="memory-word-particle memory-word-particle--two" />
      <span className="relative z-10">{item.word}</span>
    </>
  );

  if (item.href) {
    return <Link href={item.href} className="memory-floating-word" style={style}>{content}</Link>;
  }

  return <span className="memory-floating-word" style={style}>{content}</span>;
}

function Fruit({ item }: { item: MemoryTreeItem }) {
  if (item.stage === "harvested") return null;

  const slot = FRUIT_SLOTS[item.fruitSlot ?? 0] ?? FRUIT_SLOTS[0];
  const toneClass = TONE_CLASS[item.fruitTone ?? "blue"];
  const className = `memory-fruit-hit-area ${item.stage === "quiz-ready" ? "memory-fruit-hit-area--ready" : "memory-fruit-hit-area--growing"}`;
  const fruit = <span aria-hidden="true" className={`memory-fruit ${toneClass}`} />;
  const style: SceneStyle = {
    ...slot,
    "--fruit-growth": item.growth,
    "--fruit-width": `${19 + 8 * item.growth}px`,
    "--fruit-height": `${22 + 8 * item.growth}px`,
  };

  if (item.stage === "quiz-ready" && item.href) {
    return (
      <Link href={item.href} className={className} style={style} aria-label="育った実で思い出クイズに挑戦">
        {fruit}
      </Link>
    );
  }

  return (
    <button type="button" className={className} style={style} disabled aria-label={`成長中の思い出の実（${Math.round(item.growth * 100)}%）`}>
      {fruit}
    </button>
  );
}

export function MemoryTree({ items }: { items: MemoryTreeItem[] }) {
  const harvested = items.filter((item) => item.stage === "harvested" && item.word);
  const fruitItems = items.filter((item) => item.stage !== "harvested" && item.fruitSlot !== undefined);

  return (
    <section className="memory-tree-scene" aria-label="思い出の木">
      <div className="memory-word-field" aria-label="収穫した思い出の言葉">
        {harvested.map((item) => <FloatingWord key={item.id} item={item} />)}
      </div>

      <div className="memory-tree-art">
        <Image
          src="/images/memory-tree-base.png"
          alt="淡い水彩で描かれた思い出の木"
          width={864}
          height={1821}
          priority
          className="h-auto w-full"
        />
        {fruitItems.map((item) => <Fruit key={item.id} item={item} />)}
      </div>
    </section>
  );
}
