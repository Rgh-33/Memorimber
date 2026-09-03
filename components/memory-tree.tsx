"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { MemoryCard } from "@/components/memory-card";
import { GrowingTree } from "@/components/growing-tree";
import { MemoryPetal } from "@/components/memory-petal";
import { QuizSession } from "@/components/quiz-session";
import { useHarvest } from "@/lib/harvest-context";
import { getFruitQuiz } from "@/lib/tree-growth";
import type { Memory } from "@/lib/types";
import type { MemoryTreeItem } from "@/lib/tree-data";

const LONG_PRESS_MS = 120;
const GESTURE_SAMPLE_DISTANCE_PX = 14;
const GESTURE_MAX_SAMPLE_MS = 360;
const GESTURE_MIN_SPEED_PX_PER_MS = 0.14;
const GESTURE_REVERSAL_DOT_THRESHOLD = -0.5;
const GESTURE_ROTATION_STEP_RADIANS = Math.PI;
const GESTURE_MIN_TURN_RADIANS = Math.PI / 24;
const GESTURE_STEPS_REQUIRED = 12;
const SHAKE_PARTICLE_COUNT = 12;
const WORD_MIN_OPACITY = 0.72;
const WORD_MAX_OPACITY = 0.96;
const WORD_OPACITY_DISTANCE_PX = 340;

const WORD_MOTION = [
  { rotate: -6, scale: 0.94, driftX: 3, delay: -1.2 },
  { rotate: 4, scale: 0.96, driftX: -3, delay: -2.7 },
  { rotate: -3, scale: 0.98, driftX: 3, delay: -0.5 },
  { rotate: 6, scale: 0.94, driftX: -3, delay: -3.4 },
];

type HarvestedTreeItem = Extract<MemoryTreeItem, { stage: "harvested" }>;

type SceneStyle = CSSProperties & {
  "--word-current-opacity"?: number;
  "--word-scale"?: number;
  "--word-rotate"?: string;
  "--word-drift-x"?: string;
  "--float-delay"?: string;
  "--word-x"?: string;
  "--word-y"?: string;
  "--word-blur"?: string;
  "--petal-width"?: string;
  "--petal-height"?: string;
  "--shake-glow-opacity"?: number;
  "--fruit-growth"?: number;
  "--fruit-width"?: string;
  "--fruit-height"?: string;
};

type GestureState = "idle" | "pressing" | "armed" | "success";

function FloatingWord({
  item,
  isDimmed,
  getTreeRect,
  onInteractionChange,
  onReveal,
  isJustHarvested,
  onArrivalComplete,
}: {
  item: HarvestedTreeItem;
  isDimmed: boolean;
  getTreeRect: () => DOMRect | null;
  onInteractionChange: (id: string | null) => void;
  onReveal: (item: HarvestedTreeItem) => void;
  isJustHarvested: boolean;
  onArrivalComplete: (id: string) => void;
}) {
  const motion = WORD_MOTION[item.wordSlot % WORD_MOTION.length];
  const [gestureState, setGestureState] = useState<GestureState>("idle");
  const [shakeCount, setShakeCount] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [proximityOpacity, setProximityOpacity] = useState(WORD_MIN_OPACITY);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const proximityFrameRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragBoundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const motionPointRef = useRef({ x: 0, y: 0, time: 0 });
  const motionVectorRef = useRef<{ x: number; y: number } | null>(null);
  const rotationDirectionRef = useRef(0);
  const rotationAmountRef = useRef(0);
  const shakeCountRef = useRef(0);
  const armedRef = useRef(false);
  const successRef = useRef(false);

  const progress = shakeCount / GESTURE_STEPS_REQUIRED;
  const wordLength = [...item.word].length;
  const wordRows = wordLength > 6 ? 2 : 1;
  const petalWidth = Math.max(76, Math.ceil(wordLength / wordRows) * 15 + 24);
  const restingOpacity = proximityOpacity * (isDimmed ? 0.82 : 1);
  const currentOpacity = gestureState === "armed" || gestureState === "success"
    ? Math.max(0.16, restingOpacity * (1 - progress * 0.84))
    : restingOpacity;

  const style: SceneStyle = {
    "--word-current-opacity": currentOpacity,
    "--word-scale": motion.scale,
    "--word-rotate": `${motion.rotate}deg`,
    "--word-drift-x": `${motion.driftX}px`,
    "--float-delay": `${motion.delay}s`,
    "--word-x": `${dragOffset.x}px`,
    "--word-y": `${dragOffset.y}px`,
    "--word-blur": `${progress * 0.75}px`,
    "--petal-width": `${petalWidth}px`,
    "--petal-height": `${Math.max(wordRows === 2 ? 66 : 44, petalWidth / 1.8)}px`,
    "--shake-glow-opacity": progress * 0.82,
  };

  const clearTimers = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    holdTimerRef.current = null;
    resetTimerRef.current = null;
  };

  const updateProximityOpacity = useCallback(() => {
    const wordRect = buttonRef.current?.getBoundingClientRect();
    const treeRect = getTreeRect();
    if (!wordRect || !treeRect) return;

    const wordCenterX = wordRect.left + wordRect.width / 2;
    const wordCenterY = wordRect.top + wordRect.height / 2;
    const horizontalGap = Math.max(treeRect.left - wordCenterX, 0, wordCenterX - treeRect.right);
    const verticalGap = Math.max(treeRect.top - wordCenterY, 0, wordCenterY - treeRect.bottom);
    const distance = Math.hypot(horizontalGap, verticalGap);
    const proximity = 1 - Math.min(distance / WORD_OPACITY_DISTANCE_PX, 1);
    const nextOpacity = WORD_MIN_OPACITY + (WORD_MAX_OPACITY - WORD_MIN_OPACITY) * proximity;

    setProximityOpacity((current) => Math.abs(current - nextOpacity) < 0.005 ? current : nextOpacity);
  }, [getTreeRect]);

  const scheduleProximityUpdate = useCallback(() => {
    if (proximityFrameRef.current !== null) window.cancelAnimationFrame(proximityFrameRef.current);
    proximityFrameRef.current = window.requestAnimationFrame(() => {
      proximityFrameRef.current = null;
      updateProximityOpacity();
    });
  }, [updateProximityOpacity]);

  const resetGesture = () => {
    clearTimers();
    armedRef.current = false;
    successRef.current = false;
    pointerIdRef.current = null;
    motionVectorRef.current = null;
    rotationDirectionRef.current = 0;
    rotationAmountRef.current = 0;
    shakeCountRef.current = 0;
    setGestureState("idle");
    setShakeCount(0);
    onInteractionChange(null);
  };

  useEffect(() => {
    scheduleProximityUpdate();
    window.addEventListener("resize", scheduleProximityUpdate);
    return () => {
      clearTimers();
      window.removeEventListener("resize", scheduleProximityUpdate);
      if (proximityFrameRef.current !== null) window.cancelAnimationFrame(proximityFrameRef.current);
    };
  }, [scheduleProximityUpdate]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    clearTimers();
    pointerIdRef.current = event.pointerId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    dragStartOffsetRef.current = dragOffsetRef.current;
    motionPointRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    motionVectorRef.current = null;
    rotationDirectionRef.current = 0;
    rotationAmountRef.current = 0;
    shakeCountRef.current = 0;
    armedRef.current = false;
    successRef.current = false;
    setShakeCount(0);
    setGestureState("pressing");
    onInteractionChange(item.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const shell = document.querySelector<HTMLElement>(".app-shell");
    const shellRect = shell?.getBoundingClientRect();
    const wordRect = event.currentTarget.getBoundingClientRect();
    const safeLeft = Math.max(0, shellRect?.left ?? 0) + 8;
    const safeRight = Math.min(window.innerWidth, shellRect?.right ?? window.innerWidth) - 8;
    const safeTop = 8;
    const safeBottom = window.innerHeight - 90;
    dragBoundsRef.current = {
      minX: dragOffsetRef.current.x + safeLeft - wordRect.left,
      maxX: dragOffsetRef.current.x + safeRight - wordRect.right,
      minY: dragOffsetRef.current.y + safeTop - wordRect.top,
      maxY: dragOffsetRef.current.y + safeBottom - wordRect.bottom,
    };

    holdTimerRef.current = window.setTimeout(() => {
      armedRef.current = true;
      setGestureState("armed");
      motionPointRef.current = {
        x: latestPointerRef.current.x,
        y: latestPointerRef.current.y,
        time: performance.now(),
      };
      motionVectorRef.current = null;
      rotationDirectionRef.current = 0;
      rotationAmountRef.current = 0;
    }, LONG_PRESS_MS);
  };

  const addGestureSteps = (steps: number) => {
    if (steps <= 0 || successRef.current) return;

    const nextCount = Math.min(GESTURE_STEPS_REQUIRED, shakeCountRef.current + steps);
    shakeCountRef.current = nextCount;
    setShakeCount(nextCount);

    if (nextCount >= GESTURE_STEPS_REQUIRED) {
      successRef.current = true;
      armedRef.current = false;
      setGestureState("success");
      if (navigator.vibrate) navigator.vibrate(35);
      resetTimerRef.current = window.setTimeout(() => {
        onReveal(item);
        resetGesture();
      }, 520);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    if (!armedRef.current || successRef.current) return;

    const bounds = dragBoundsRef.current;
    const nextOffset = {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, dragStartOffsetRef.current.x + event.clientX - pointerStartRef.current.x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, dragStartOffsetRef.current.y + event.clientY - pointerStartRef.current.y)),
    };
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
    scheduleProximityUpdate();

    const motionPoint = motionPointRef.current;
    const deltaX = event.clientX - motionPoint.x;
    const deltaY = event.clientY - motionPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    const elapsed = Math.max(1, event.timeStamp - motionPoint.time);

    if (distance < GESTURE_SAMPLE_DISTANCE_PX) {
      if (elapsed > GESTURE_MAX_SAMPLE_MS) {
        motionPointRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
        motionVectorRef.current = null;
        rotationDirectionRef.current = 0;
        rotationAmountRef.current = 0;
      }
      return;
    }

    const speed = distance / elapsed;
    const nextVector = { x: deltaX / distance, y: deltaY / distance };
    const previousVector = motionVectorRef.current;
    motionPointRef.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    motionVectorRef.current = nextVector;

    if (elapsed > GESTURE_MAX_SAMPLE_MS || speed < GESTURE_MIN_SPEED_PX_PER_MS) {
      shakeCountRef.current = 0;
      setShakeCount(0);
      rotationDirectionRef.current = 0;
      rotationAmountRef.current = 0;
      return;
    }

    if (!previousVector) return;

    const dot = previousVector.x * nextVector.x + previousVector.y * nextVector.y;
    const cross = previousVector.x * nextVector.y - previousVector.y * nextVector.x;
    const turnAngle = Math.atan2(cross, dot);

    if (dot <= GESTURE_REVERSAL_DOT_THRESHOLD) {
      rotationDirectionRef.current = 0;
      rotationAmountRef.current = 0;
      addGestureSteps(1);
      return;
    }

    if (Math.abs(turnAngle) < GESTURE_MIN_TURN_RADIANS) return;

    const turnDirection = turnAngle > 0 ? 1 : -1;
    if (rotationDirectionRef.current !== 0 && rotationDirectionRef.current !== turnDirection) {
      rotationAmountRef.current = 0;
    }
    rotationDirectionRef.current = turnDirection;
    rotationAmountRef.current += Math.abs(turnAngle);

    const rotationSteps = Math.floor(rotationAmountRef.current / GESTURE_ROTATION_STEP_RADIANS);
    if (rotationSteps > 0) {
      rotationAmountRef.current %= GESTURE_ROTATION_STEP_RADIANS;
      addGestureSteps(rotationSteps);
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId || successRef.current) return;
    resetGesture();
  };

  const activeParticleCount = Math.min(
    SHAKE_PARTICLE_COUNT,
    Math.ceil(shakeCount * SHAKE_PARTICLE_COUNT / GESTURE_STEPS_REQUIRED),
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      className="memory-floating-word"
      data-memory-id={item.memoryId ?? item.id}
      style={style}
      data-gesture={gestureState}
      data-dimmed={isDimmed || undefined}
      aria-label={`${item.word}。長押しすると画面内を移動できます。縦横に振るか、くるくる回して${GESTURE_STEPS_REQUIRED}回分の動きを加えると思い出を表示します`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0) onReveal(item);
      }}
    >
      <span aria-hidden="true" className="memory-word-particle memory-word-particle--one" />
      <span aria-hidden="true" className="memory-word-particle memory-word-particle--two" />
      <span className="memory-word-shake-particles" aria-hidden="true">
        {Array.from({ length: SHAKE_PARTICLE_COUNT }, (_, index) => (
          <span key={index} className={`memory-word-shake-particle ${index < activeParticleCount ? "memory-word-shake-particle--active" : ""}`} />
        ))}
      </span>
      <span
        className={`konoha-petal-arrive${isJustHarvested ? " konoha-petal-arrive--just-harvested" : ""}`}
        onAnimationEnd={(event) => {
          if (isJustHarvested && event.currentTarget === event.target) {
            onArrivalComplete(item.memoryId ?? item.id);
          }
        }}
      >
        <span className="konoha-petal-sway">
          <MemoryPetal />
          <span className="memory-floating-word-label">{item.word}</span>
        </span>
      </span>
    </button>
  );
}

export function MemoryTree({ items, petals, memories, count, totalCount, month }: {
  items: MemoryTreeItem[];
  petals: HarvestedTreeItem[];
  memories: Memory[];
  count: number;
  totalCount: number;
  month: string;
}) {
  const harvest = useHarvest();
  const [revealedItem, setRevealedItem] = useState<HarvestedTreeItem | null>(null);
  const [quizMemoryId, setQuizMemoryId] = useState<string | null>(null);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const treeArtRef = useRef<HTMLDivElement>(null);
  // Keep every word in the page. New harvests arrive first; wrapping the field
  // moves the tree down instead of hiding older words behind a page control.
  const shownWords = useMemo(() => [...petals].reverse(), [petals]);
  const memoriesById = useMemo(() => new Map(memories.map((memory) => [memory.id, memory])), [memories]);
  const fruitQuiz = useMemo(() => getFruitQuiz(memories, items, quizMemoryId), [items, memories, quizMemoryId]);
  const relatedMemoryIds = revealedItem?.relatedMemoryIds?.length
    ? revealedItem.relatedMemoryIds
    : revealedItem?.memoryId
      ? [revealedItem.memoryId]
      : [];
  const relatedMemories = relatedMemoryIds.flatMap((id) => {
    const memory = memoriesById.get(id);
    return memory ? [memory] : [];
  });
  const getTreeRect = useCallback(() => treeArtRef.current?.getBoundingClientRect() ?? null, []);

  useEffect(() => {
    if (!revealedItem) return;

    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRevealedItem(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [revealedItem]);

  return (
    <section className="memory-tree-scene konoha-scene" aria-label="思い出の木" tabIndex={-1}>
      <div className="memory-word-field" aria-label="収穫した思い出の言葉">
        {shownWords.map((item) => (
          <FloatingWord
            key={item.id}
            item={item}
            isDimmed={activeWordId !== null && activeWordId !== item.id}
            getTreeRect={getTreeRect}
            onInteractionChange={setActiveWordId}
            onReveal={setRevealedItem}
            isJustHarvested={harvest.arrivingMemoryId === (item.memoryId ?? item.id)}
            onArrivalComplete={harvest.completeArrival}
          />
        ))}
      </div>

      <div ref={treeArtRef} className="memory-tree-art konoha-tree-art">
        <GrowingTree items={items} memories={memories} count={count} totalCount={totalCount} month={month} onFruitSelect={(memoryId) => {
          setRevealedItem(null);
          setQuizMemoryId(memoryId);
        }} />
      </div>

      <p className="sr-only" aria-live="polite">
        {revealedItem ? `${revealedItem.word}に関連する思い出を表示しました` : ""}
      </p>

      {revealedItem && (
        <div className="memory-reveal-overlay" onClick={() => setRevealedItem(null)}>
          <section
            className="memory-reveal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-reveal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button ref={closeButtonRef} type="button" className="memory-reveal-close" onClick={() => setRevealedItem(null)} aria-label="思い出を閉じる">
              <X size={18} />
            </button>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-coral">REMEMBERED</p>
            <h2 id="memory-reveal-title" className="mt-2 pr-8 text-xl font-semibold tracking-[0.04em] text-ink">
              「{revealedItem.word}」の思い出
            </h2>
            <p className="mt-2 text-xs leading-5 text-ink/55">長押ししながら揺らして、記憶を呼び戻しました。</p>

            <div className="memory-reveal-list">
              {relatedMemories.length > 0 ? (
                relatedMemories.map((memory) => <MemoryCard key={memory.id} memory={memory} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-line bg-paper/55 px-5 py-10 text-center text-sm text-ink/55">
                  この言葉に関連する思い出は、これから追加されます。
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {fruitQuiz && (
        <div className="konoha-quiz-overlay" onClick={() => setQuizMemoryId(null)}>
          <QuizSession
            key={fruitQuiz.memory.id}
            quiz={fruitQuiz}
            variant="dialog"
            onClose={() => setQuizMemoryId(null)}
            onHarvest={() => setQuizMemoryId(null)}
          />
        </div>
      )}
    </section>
  );
}
