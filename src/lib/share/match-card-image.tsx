import {
  BRAND_GREEN_BRIGHT,
  FAINT_BORDER,
  GOLD,
  InitialAvatar,
  MUTED,
  ShareCardBackground,
  ShareCardFooter,
  ShareCardHeader,
  WHITE,
} from "@/lib/share/card-chrome";
import type { MatchShareData, MatchShareSide } from "@/lib/share/match-card-data";

/**
 * One side of the matchup: avatar(s) + name(s), the winner badge, and the
 * per-set score row - mirrored left/right (`align`) so both sides visually
 * face the center divider, like a broadcast scoreboard graphic. A winner's
 * numbers are bright/full-opacity, a loser's are dimmed - the score itself
 * carries who-won at a glance, not just the badge above the name.
 */
function MatchCardSide({ side, align }: { side: MatchShareSide; align: "left" | "right" }) {
  const isLeft = align === "left";
  const rowDirection = isLeft ? "row" : "row-reverse";
  const avatarSize = side.players.length > 1 ? 52 : 64;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1, alignItems: isLeft ? "flex-start" : "flex-end" }}>
      {side.isWinner ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#3b2504",
            background: GOLD,
            padding: "7px 16px",
            borderRadius: 999,
          }}
        >
          <span>🏆</span>
          <span>Перемога</span>
        </div>
      ) : (
        // Empty spacer of the same height as the winner badge above, so both
        // names start at the same baseline whichever side won.
        <div style={{ display: "flex", height: 33 }} />
      )}

      <div style={{ display: "flex", flexDirection: rowDirection, alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {side.players.slice(0, 2).map((player) => (
            <InitialAvatar
              key={player.name}
              label={player.name}
              image={player.image}
              tone={side.isWinner ? "accent" : "muted"}
              size={avatarSize}
            />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: isLeft ? "flex-start" : "flex-end" }}>
          {side.players.map((player) => (
            <span
              key={player.name}
              style={{
                display: "flex",
                fontSize: side.isWinner ? 36 : 29,
                fontWeight: side.isWinner ? 800 : 600,
                color: side.isWinner ? WHITE : MUTED,
              }}
            >
              {player.name}
            </span>
          ))}
        </div>
      </div>

      {side.sets.length > 0 && (
        <div style={{ display: "flex", flexDirection: rowDirection, gap: 24 }}>
          {side.sets.map((set, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  display: "flex",
                  fontSize: 46,
                  fontWeight: 800,
                  color: side.isWinner ? BRAND_GREEN_BRIGHT : WHITE,
                  opacity: side.isWinner ? 1 : 0.55,
                }}
              >
                {set.value}
              </span>
              {set.tiebreak != null && (
                <span style={{ display: "flex", fontSize: 17, fontWeight: 600, color: MUTED }}>({set.tiebreak})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * JSX for the match-result share card (see src/app/api/share/match/[id]/route.tsx),
 * rendered through next/og's ImageResponse - Satori (its layout engine) only
 * supports flexbox + a subset of CSS via inline `style` objects, no Tailwind
 * classes and no external stylesheet, so this deliberately duplicates rather
 * than reuses MatchSummary's (Tailwind-based) markup. Not unit-tested, same
 * as every other ImageResponse element in this app (src/lib/brand-icon.tsx) -
 * the data shaping this depends on (src/lib/share/match-card-data.ts) is
 * tested instead.
 */
export function matchShareCardElement(data: MatchShareData) {
  const { tournamentName, round, matchTypeLabel, badge, sideA, sideB } = data;
  const subtitle = [matchTypeLabel, round].filter(Boolean).join(" · ");

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
        <ShareCardHeader eyebrow="Результат матчу" pill={{ title: tournamentName, subtitle }} />

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 36,
            padding: "40px 48px",
            borderRadius: 28,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${FAINT_BORDER}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          }}
        >
          <MatchCardSide side={sideA} align="left" />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 18,
            }}
          >
            <span style={{ display: "flex", fontSize: 22 }}>🎾</span>
            <div
              style={{
                display: "flex",
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 800,
                color: MUTED,
                background: "rgba(255,255,255,0.08)",
                border: `1px solid ${FAINT_BORDER}`,
              }}
            >
              VS
            </div>
            <span style={{ display: "flex", fontSize: 22 }}>🎾</span>
          </div>
          <MatchCardSide side={sideB} align="right" />
        </div>

        <ShareCardFooter left={badge ?? undefined} />
      </div>
    </div>
  );
}
