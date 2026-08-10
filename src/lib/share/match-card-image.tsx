import type { MatchShareData, MatchShareSide } from "@/lib/share/match-card-data";

// Same brand green as src/lib/brand-icon.tsx (#3f7a5c) - kept literal here
// rather than imported, since brand-icon.tsx exports a JSX-building function
// (brandIconElement), not a bare color token, and Tailwind's CSS variables
// (--primary etc.) don't exist in this render path at all - Satori only sees
// the inline `style` objects below, never globals.css.
const BRAND_GREEN = "#3f7a5c";
const BRAND_GREEN_DARK = "#1f3f2d";

function MatchCardSide({ side }: { side: MatchShareSide }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, flex: 1 }}>
      {side.isWinner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 16,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "#fcd34d",
            background: "rgba(0,0,0,0.28)",
            padding: "4px 12px 4px 8px",
            borderRadius: 999,
          }}
        >
          <span>🏆</span>
          <span>Перемога</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 30,
          fontWeight: side.isWinner ? 800 : 500,
          opacity: side.isWinner ? 1 : 0.8,
        }}
      >
        {side.names.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      {side.sets.length > 0 && (
        <div style={{ display: "flex", gap: 10 }}>
          {side.sets.map((set, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 3,
                background: "rgba(255,255,255,0.16)",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700 }}>{set.value}</span>
              {set.tiebreak != null && <span style={{ fontSize: 14, opacity: 0.7 }}>({set.tiebreak})</span>}
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.9 }}>{tournamentName}</span>
            <span style={{ fontSize: 17, opacity: 0.7 }}>{subtitle}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <MatchCardSide side={sideA} />
          <span style={{ display: "flex", fontSize: 24, fontWeight: 700, opacity: 0.5 }}>VS</span>
          <MatchCardSide side={sideB} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", fontSize: 18, opacity: 0.75 }}>
          <span style={{ display: "flex" }}>{badge ?? ""}</span>
          <span style={{ display: "flex" }}>set-club.vercel.app</span>
        </div>
      </div>
    </div>
  );
}
