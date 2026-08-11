import { countLabel, PARTICIPANT_FORMS } from "@/lib/pluralize";
import {
  FAINT_BORDER,
  MUTED,
  ShareCardBackground,
  ShareCardFooter,
  ShareCardHeader,
  WHITE,
} from "@/lib/share/card-chrome";
import type { TournamentPodiumEntry, TournamentShareData } from "@/lib/share/tournament-card-data";

// Matches src/lib/rank-style.ts's RANK_STYLE gold/silver/bronze triad (its
// Tailwind classes - amber-500/zinc-400/orange-700 - can't apply inside
// Satori's rendering, so these are that same palette's raw hex values).
const PLACE_COLOR: Record<1 | 2 | 3, string> = { 1: "#f59e0b", 2: "#a1a1aa", 3: "#c2410c" };
const PLACE_HEIGHT: Record<1 | 2 | 3, number> = { 1: 220, 2: 176, 3: 144 };

function PodiumColumn({ entry }: { entry: TournamentPodiumEntry }) {
  const isFirst = entry.place === 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
      {isFirst && <span style={{ display: "flex", fontSize: 34 }}>🏆</span>}
      <span style={{ display: "flex", fontSize: 24, fontWeight: 700, color: WHITE, textAlign: "center" }}>
        {entry.label}
      </span>
      <span style={{ display: "flex", fontSize: 16, color: MUTED }}>
        {entry.wins}-{entry.losses}
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 14,
          width: "100%",
          height: PLACE_HEIGHT[entry.place],
          borderRadius: "18px 18px 0 0",
          background: `linear-gradient(180deg, ${PLACE_COLOR[entry.place]}33 0%, rgba(255,255,255,0.05) 100%)`,
          border: `1px solid ${FAINT_BORDER}`,
          borderBottom: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            borderRadius: 22,
            background: PLACE_COLOR[entry.place],
            color: "#241705",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 21,
            fontWeight: 800,
            boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
          }}
        >
          {entry.place}
        </div>
      </div>
    </div>
  );
}

/**
 * JSX for the tournament-podium share card (see
 * src/app/api/share/tournament/[id]/route.tsx) - same Satori/flexbox-only
 * constraints, shared chrome, and "not unit-tested" convention as
 * match-card-image.tsx. Podium order is drawn 2nd-1st-3rd (classic podium
 * shape) by iterating a fixed [2, 1, 3] order rather than relying on flex
 * `order`.
 */
export function tournamentShareCardElement(data: TournamentShareData) {
  const { tournamentName, participantCount, podium } = data;
  const byPlace = new Map(podium.map((entry) => [entry.place, entry]));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        color: WHITE,
      }}
    >
      <ShareCardBackground />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "52px 64px",
        }}
      >
        <ShareCardHeader eyebrow="Підсумки турніру" pill={{ title: tournamentName }} />

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 28,
            padding: "0 48px",
          }}
        >
          {[2, 1, 3].map((place) => {
            const entry = byPlace.get(place as 1 | 2 | 3);
            return entry ? <PodiumColumn key={place} entry={entry} /> : null;
          })}
        </div>

        <ShareCardFooter left={countLabel(participantCount, PARTICIPANT_FORMS)} />
      </div>
    </div>
  );
}
