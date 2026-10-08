"use client";

import { LockIcon, TrophyIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { MoonBallIcon } from "@/components/moon-ball-icon";
import { Button } from "@/components/ui/button";
import type { Achievement } from "@/lib/achievements";
import { formatDateKyiv } from "@/lib/date-format";
import { cn } from "@/lib/utils";

/** Per-viewer UI preference, not shared data - see the localStorage guidance in docs/ACHIEVEMENTS.md. Scoped to this player's own achievements block; other profiles aren't affected. */
const HIDE_STORAGE_KEY = "setclub:achievements-hidden";

// The preference lives outside React (localStorage), so it's read through
// useSyncExternalStore - the idiomatic way to subscribe to an external store, and
// hydration-safe without a setState-in-an-effect: the server (and the hydrating render)
// use getServerSnapshot = visible, then the real stored value takes over on the client.
const hiddenListeners = new Set<() => void>();
/** Set once the viewer toggles - also the fallback when storage is blocked, so the toggle still works for this page view. */
let hiddenOverride: boolean | null = null;

function readHiddenPreference(): boolean {
  if (hiddenOverride !== null) return hiddenOverride;
  try {
    return localStorage.getItem(HIDE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHiddenPreference(hidden: boolean) {
  hiddenOverride = hidden;
  try {
    localStorage.setItem(HIDE_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Private browsing / blocked storage - the toggle still works for this
    // page view (hiddenOverride), it just won't be remembered next visit.
  }
  hiddenListeners.forEach((listener) => listener());
}

function subscribeToHiddenPreference(listener: () => void) {
  hiddenListeners.add(listener);
  return () => {
    hiddenListeners.delete(listener);
  };
}

export function PlayerAchievements({ achievements }: { achievements: Achievement[] }) {
  const hidden = useSyncExternalStore(subscribeToHiddenPreference, readHiddenPreference, () => false);

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
          onClick={() => writeHiddenPreference(!hidden)}
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
        achievement.icon === "moon-ball" ? (
          <MoonBallIcon className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <TrophyIcon className="size-3.5 shrink-0 text-amber-500" aria-hidden />
        )
      ) : (
        <LockIcon className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className={achievement.earned ? "font-medium" : ""}>{achievement.label}</span>
    </div>
  );
}
