"use client";

import { LockIcon, TrophyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Achievement } from "@/lib/achievements";
import { formatDateKyiv } from "@/lib/date-format";
import { cn } from "@/lib/utils";

/** Per-viewer UI preference, not shared data - see the localStorage guidance in docs/ACHIEVEMENTS.md. Scoped to this player's own achievements block; other profiles aren't affected. */
const HIDE_STORAGE_KEY = "setclub:achievements-hidden";

function readHiddenPreference(): boolean {
  try {
    return localStorage.getItem(HIDE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHiddenPreference(hidden: boolean) {
  try {
    localStorage.setItem(HIDE_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Private browsing / blocked storage - the toggle still works for this
    // page view, it just won't be remembered next visit.
  }
}

export function PlayerAchievements({ achievements }: { achievements: Achievement[] }) {
  // Starts visible on the server-rendered markup (no flash of an unstyled
  // "hidden" state) and only switches to the remembered preference once
  // mounted in the browser, same reasoning as any localStorage-backed toggle.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(readHiddenPreference());
  }, []);

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Досягнення{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({earnedCount} з {achievements.length})
          </span>
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = !hidden;
            setHidden(next);
            writeHiddenPreference(next);
          }}
        >
          {hidden ? "Показати" : "Сховати"}
        </Button>
      </div>
      {!hidden && (
        <div className="flex flex-wrap gap-2">
          {achievements.map((achievement) => (
            <AchievementChip key={achievement.id} achievement={achievement} />
          ))}
        </div>
      )}
    </div>
  );
}

function AchievementChip({ achievement }: { achievement: Achievement }) {
  // formatDateKyiv, not toLocaleDateString: earnedAt mixes a UTC-midnight
  // date-only value (scheduledDate) with genuine timestamps (completedAt/
  // createdAt) - see AchievementMatchInput.playedAt. formatDateKyiv is safe
  // for both (Kyiv is always UTC+, so UTC midnight never shifts to the
  // previous day) and hydration-safe (fixed timezone, not the visitor's or
  // server's) - toLocaleDateString is neither, see date-format.ts.
  const earnedDate = achievement.earnedAt ? formatDateKyiv(new Date(achievement.earnedAt)) : undefined;
  const title = earnedDate ? `${achievement.description} — здобуто ${earnedDate}` : achievement.description;

  return (
    <div
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
        achievement.earned
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {achievement.earned ? (
        <TrophyIcon className="size-3.5 shrink-0 text-amber-500" aria-hidden />
      ) : (
        <LockIcon className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className={achievement.earned ? "font-medium" : ""}>{achievement.label}</span>
    </div>
  );
}
