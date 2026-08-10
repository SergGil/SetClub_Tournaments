import { countLabel, PARTICIPANT_FORMS } from "@/lib/pluralize";
import type { TournamentPodiumEntry, TournamentShareData } from "@/lib/share/tournament-card-data";

// Same brand green as match-card-image.tsx/src/lib/brand-icon.tsx - see that
// file's comment for why it's a literal here instead of a shared import.
const BRAND_GREEN = "#3f7a5c";
const BRAND_GREEN_DARK = "#1f3f2d";

// Matches src/lib/rank-style.ts's RANK_STYLE gold/silver/bronze triad (its
// Tailwind classes - amber-500/zinc-400/orange-700 - can't apply inside
// Satori's rendering, so these are that same palette's raw hex values).
const PLACE_COLOR: Record<1 | 2 | 3, string> = { 1: "#f59e0b", 2: "#a1a1aa", 3: "#c2410c" };

function PodiumColumn({ entry }: { entry: TournamentPodiumEntry }) {
  const isFirst = entry.place === 1;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        flex: 1,
        minHeight: entry.place === 1 ? 168 : entry.place === 2 ? 132 : 108,
        justifyContent: "center",
        background: "rgba(255,255,255,0.12)",
        borderRadius: "14px 14px 0 0",
        padding: isFirst ? "0 14px 18px" : "0 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 40,
          height: 40,
          borderRadius: 20,
          background: PLACE_COLOR[entry.place],
          color: "#1f2937",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        {entry.place}
      </div>
      <div style={{ display: "flex", fontSize: 22, fontWeight: 700, textAlign: "center" }}>{entry.label}</div>
      <div style={{ display: "flex", fontSize: 15, opacity: 0.75 }}>
        {entry.wins}-{entry.losses}
      </div>
    </div>
  );
}

/**
 * JSX for the tournament-podium share card (see
 * src/app/api/share/tournament/[id]/route.tsx) - same Satori/flexbox-only
 * constraints and "not unit-tested" convention as match-card-image.tsx.
 * Podium order is drawn 2nd-1st-3rd (classic podium shape) by iterating a
 * fixed [2, 1, 3] order rather than relying on flex `order`.
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
        color: "#ffffff",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          background: `linear-gradient(155deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_DARK} 100%)`,
        }}
      />
      <div style={{ position: "absolute", left: "6%", right: "6%", top: "8%", height: 2, display: "flex", background: "rgba(255,255,255,0.35)" }} />
      <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "8%", height: 2, display: "flex", background: "rgba(255,255,255,0.35)" }} />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 68px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 700 }}>
          <div
            style={{
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "#ffffff",
              color: BRAND_GREEN_DARK,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            S.
          </div>
          SET.club
          <span style={{ display: "flex", fontSize: 19, fontWeight: 500, opacity: 0.7 }}>· Підсумки турніру</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800 }}>{tournamentName}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            {[2, 1, 3].map((place) => {
              const entry = byPlace.get(place as 1 | 2 | 3);
              return entry ? <PodiumColumn key={place} entry={entry} /> : null;
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: 18, opacity: 0.75 }}>
          <span style={{ display: "flex" }}>{countLabel(participantCount, PARTICIPANT_FORMS)}</span>
          <span style={{ display: "flex" }}>set-club.vercel.app</span>
        </div>
      </div>
    </div>
  );
}
