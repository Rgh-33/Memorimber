"use client";

import {
  Award,
  CalendarDays,
  Gamepad2,
  Images,
  Infinity as InfinityIcon,
  Lightbulb,
  Medal,
  Network,
  Palette,
  RefreshCcw,
  Share2,
  Sparkles,
  Sprout,
  Trophy,
  UserRoundPlus,
  UsersRound,
  Wind,
} from "lucide-react";
import { useState } from "react";
import { PROFILE_MEDALS, type ProfileActivityStats, type ProfileMedal } from "@/lib/profile-data";

const MEDAL_ICONS = {
  photo: Images,
  fruit: Sprout,
  quiz: Lightbulb,
  calendar: CalendarDays,
  petal: Wind,
  revive: RefreshCcw,
  word: Sparkles,
  golden: Award,
  groups: UsersRound,
  groupCreate: UserRoundPlus,
  connections: Network,
  groupQuiz: Gamepad2,
  winner: Trophy,
  endless: InfinityIcon,
  share: Share2,
  design: Palette,
} as const;

export function ProfileRecordGrid({ stats }: { stats: ProfileActivityStats }) {
  const [selectedMedalId, setSelectedMedalId] = useState<string | null>(null);
  const medalRows = Array.from({ length: Math.ceil(PROFILE_MEDALS.length / 4) }, (_, rowIndex) =>
    PROFILE_MEDALS.slice(rowIndex * 4, rowIndex * 4 + 4),
  );

  return (
    <section className="mt-4 px-1" aria-labelledby="profile-medals-heading">
      <div className="flex items-center gap-2.5">
        <Medal size={24} className="text-coral" strokeWidth={1.8} />
        <h2 id="profile-medals-heading" className="text-lg font-semibold text-ink">記録</h2>
      </div>
      <div className="mt-5 space-y-5">
        {medalRows.map((row, rowIndex) => {
          const selectedMedal = row.find((medal) => medal.id === selectedMedalId);
          return (
            <div key={`record-row-${rowIndex}`}>
              <div className="grid grid-cols-4 gap-2">
                {row.map((medal: ProfileMedal) => {
                  const Icon = MEDAL_ICONS[medal.icon];
                  const selected = selectedMedalId === medal.id;
                  return (
                    <button
                      key={medal.id}
                      type="button"
                      onClick={() => setSelectedMedalId((current) => current === medal.id ? null : medal.id)}
                      aria-expanded={selected}
                      aria-label={medal.label}
                      className={`mx-auto grid h-14 w-14 place-items-center rounded-full border transition ${
                        selected ? "border-coral bg-coral text-white shadow-card" : "border-line bg-paper text-coral hover:border-coral"
                      }`}
                    >
                      <Icon size={23} strokeWidth={1.7} />
                    </button>
                  );
                })}
              </div>
              {selectedMedal && (
                <div className="mt-5 rounded-xl border border-line bg-paper px-4 py-4 text-center">
                  <p className="text-xs font-semibold text-coral">{selectedMedal.label}</p>
                  <p className="mt-2 text-xs leading-6 text-ink/60">{selectedMedal.describe(stats)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
