import { countLabel, MATCH_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import {
  FAINT_BORDER,
  GOLD,
  MUTED,
  ShareCardBackground,
  ShareCardFooter,
  ShareCardHeader,
  WHITE,
} from "@/lib/share/card-chrome";
import type { SeasonShareData } from "@/lib/share/season-card-data";

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "flex", fontSize: 48, fontWeight: 800, color: WHITE }}>{value}</span>
      <span style={{ display: "flex", fontSize: 16, color: MUTED }}>{label}</span>
    </div>
  );
}

function LeaderBlock({ label, entry }: { label: string; entry: { name: string; points: number } | null }) {
  if (!entry) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${FAINT_BORDER}`,
        borderRadius: 16,
        padding: "20px 24px",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: GOLD }}>
        🏆 {label}
      </span>
      <span style={{ display: "flex", fontSize: 27, fontWeight: 800, color: WHITE }}>{entry.name}</span>
      <span style={{ display: "flex", fontSize: 15, color: MUTED }}>{entry.points} балів SET.club</span>
    </div>
  );
}

/**
 * JSX for the "Рік у SET.club" season-recap share card (see
 * src/app/api/share/season/[year]/route.tsx) - same Satori/flexbox-only
 * constraints, shared chrome, and "not unit-tested" convention as
 * match-card-image.tsx/tournament-card-image.tsx.
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
        <ShareCardHeader eyebrow="Підсумки сезону" />

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span style={{ display: "flex", fontSize: 48, fontWeight: 800, color: WHITE }}>{year} рік у SET.club</span>
          <div style={{ display: "flex", gap: 48 }}>
            <StatBlock value={matchesPlayed} label={countLabel(matchesPlayed, MATCH_FORMS)} />
            <StatBlock value={tournamentsCompleted} label={countLabel(tournamentsCompleted, TOURNAMENT_FORMS)} />
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <LeaderBlock label="Топ одиночний" entry={data.topSingles} />
            <LeaderBlock label="Топ парний" entry={data.topDoubles} />
          </div>
        </div>

        <ShareCardFooter />
      </div>
    </div>
  );
}
