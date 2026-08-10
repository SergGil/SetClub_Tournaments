import { countLabel, MATCH_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import type { SeasonShareData } from "@/lib/share/season-card-data";

// Same brand green as match-card-image.tsx/tournament-card-image.tsx/
// src/lib/brand-icon.tsx - see match-card-image.tsx's comment for why it's a
// literal here instead of a shared import.
const BRAND_GREEN = "#3f7a5c";
const BRAND_GREEN_DARK = "#1f3f2d";

function LeaderBlock({ label, entry }: { label: string; entry: { name: string; points: number } | null }) {
  if (!entry) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flex: 1,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "18px 20px",
      }}
    >
      <span style={{ display: "flex", fontSize: 15, opacity: 0.75 }}>🏆 {label}</span>
      <span style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>{entry.name}</span>
      <span style={{ display: "flex", fontSize: 15, opacity: 0.8 }}>{entry.points} балів SET.club</span>
    </div>
  );
}

/**
 * JSX for the "Рік у SET.club" season-recap share card (see
 * src/app/api/share/season/[year]/route.tsx) - same Satori/flexbox-only
 * constraints, "long position properties, never `inset`" rule, and
 * "not unit-tested" convention as match-card-image.tsx/tournament-card-image.tsx.
 */
export function seasonShareCardElement(data: SeasonShareData) {
  const { year, matchesPlayed, tournamentsCompleted } = data;

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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800 }}>{year} рік у SET.club</div>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>{matchesPlayed}</span>
              <span style={{ display: "flex", fontSize: 16, opacity: 0.8 }}>{countLabel(matchesPlayed, MATCH_FORMS)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", fontSize: 38, fontWeight: 800 }}>{tournamentsCompleted}</span>
              <span style={{ display: "flex", fontSize: 16, opacity: 0.8 }}>
                {countLabel(tournamentsCompleted, TOURNAMENT_FORMS)}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <LeaderBlock label="Топ одиночний" entry={data.topSingles} />
            <LeaderBlock label="Топ парний" entry={data.topDoubles} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 18, opacity: 0.75 }}>
          <span style={{ display: "flex" }}>set-club.vercel.app</span>
        </div>
      </div>
    </div>
  );
}
