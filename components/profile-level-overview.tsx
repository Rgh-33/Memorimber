"use client";

import { ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";
import {
  PROFILE_LEVEL_REQUIREMENTS,
  type ProfileLevelRequirement,
  getProfileLevelProgress,
} from "@/lib/profile-data";

type LevelProgress = ReturnType<typeof getProfileLevelProgress>;

function LevelRequirementCard({
  requirement,
  isCurrent = false,
  itemRef,
}: {
  requirement: ProfileLevelRequirement | null;
  isCurrent?: boolean;
  itemRef?: Ref<HTMLElement>;
}) {
  const level = requirement?.level ?? 1;

  return (
    <article ref={itemRef} className={`profile-level-requirement ${isCurrent ? "profile-level-requirement--current" : ""}`}>
      <p className="text-sm font-semibold">レベル {level} 条件</p>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5">
        {requirement ? <span>写真を{requirement.photosRequired}枚追加</span> : <span>思い出の記録をはじめる</span>}
        {requirement?.additionalCondition && <span>{requirement.additionalCondition.label}</span>}
      </div>
    </article>
  );
}

export function ProfileLevelOverview({ levelProgress }: { levelProgress: LevelProgress }) {
  const [levelDetailsOpen, setLevelDetailsOpen] = useState(false);
  const levelListRef = useRef<HTMLDivElement>(null);
  const currentLevelRef = useRef<HTMLElement>(null);
  const visualProgress = Math.max(0, Math.min(1, levelProgress.progress));
  const allLevelRequirements: Array<ProfileLevelRequirement | null> = [null, ...PROFILE_LEVEL_REQUIREMENTS];
  const activeRequirementLevel = levelProgress.nextRequirement?.level ?? null;

  useEffect(() => {
    if (!levelDetailsOpen) return;
    const frameId = window.requestAnimationFrame(() => {
      const list = levelListRef.current;
      const currentLevel = currentLevelRef.current;
      if (!list || !currentLevel) return;
      list.scrollTop += currentLevel.getBoundingClientRect().top - list.getBoundingClientRect().top;
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLevelDetailsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [levelDetailsOpen]);

  return (
    <>
      <div className="profile-level-summary" aria-label={`現在のレベルは${levelProgress.level}です`}>
        <div className="relative w-fit text-left text-coral">
          <span className="block text-[38px] font-semibold leading-none tabular-nums">{levelProgress.level}</span>
          <span className="mt-1.5 block text-[10px] font-semibold tracking-[0.12em]">レベル</span>
          <button
            type="button"
            onClick={() => setLevelDetailsOpen(true)}
            className="absolute left-full top-2 ml-1 grid h-8 w-8 place-items-center rounded-full text-coral transition hover:bg-coral/10"
            aria-label="すべてのレベル条件を見る"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="profile-level-track mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(visualProgress * 100)}>
          <div className="profile-level-progress" style={{ width: `${visualProgress * 100}%` }} />
        </div>
        <p className="profile-level-fraction mt-2" aria-label={`${levelProgress.photosIntoLevel}/${levelProgress.photosForNextLevel}`}>
          <span className="profile-level-fraction-current">{levelProgress.photosIntoLevel}</span>
          <span className="profile-level-fraction-slash" aria-hidden="true">/</span>
          <span>{levelProgress.photosForNextLevel}</span>
        </p>
      </div>

      {levelDetailsOpen && (
        <div className="profile-level-overlay" onClick={() => setLevelDetailsOpen(false)}>
          <section
            className="profile-level-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-level-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-coral">LEVEL GUIDE</p>
                <h2 id="profile-level-dialog-title" className="mt-1 text-lg font-semibold text-ink">レベルアップ</h2>
              </div>
              <button type="button" onClick={() => setLevelDetailsOpen(false)} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-ivory text-ink" aria-label="閉じる">
                <X size={17} />
              </button>
            </div>

            <p className="mb-2 mt-5 text-[10px] font-semibold tracking-[0.14em] text-ink/45">レベル1〜20</p>
            <div ref={levelListRef} className="profile-level-list">
              <div className="space-y-2.5">
                {allLevelRequirements.map((requirement) => {
                  const level = requirement?.level ?? 1;
                  const isCurrent = level === activeRequirementLevel;
                  return (
                    <LevelRequirementCard
                      key={level}
                      requirement={requirement}
                      isCurrent={isCurrent}
                      itemRef={isCurrent ? currentLevelRef : undefined}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
