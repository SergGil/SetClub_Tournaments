// Shared visual language for every share card (match/tournament/season) -
// extracted once all three needed the same header/background/footer/avatar
// treatment, rather than tripling a design this detailed across three files
// (the earlier "duplicate the BRAND_GREEN literal" convention was fine for a
// single hex value, not for this much layout). Same Satori/flexbox-only
// constraints as before: absolutely-positioned elements need explicit
// top/left/right/bottom (never the `inset` shorthand - see docs/SHARE_CARDS.md).

export const BRAND_GREEN = "#3f7a5c";
export const BRAND_GREEN_BRIGHT = "#34d399";
export const BASE_DARK = "#0c1f16";
export const GOLD = "#f5b942";
export const WHITE = "#ffffff";
export const MUTED = "rgba(255,255,255,0.62)";
export const FAINT_BORDER = "rgba(255,255,255,0.14)";

/**
 * Full-bleed dark base plus two soft radial "glow" orbs (green top-right,
 * gold bottom-left) instead of the old single flat diagonal gradient fill -
 * that flat fill plus two thin hairlines was the whole background, which is
 * what read as dated/flat. Orbs sit slightly off-canvas (negative
 * top/right/bottom/left) so only their soft edge shows.
 */
export function ShareCardBackground() {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", background: BASE_DARK }} />
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -180,
          width: 620,
          height: 620,
          borderRadius: 9999,
          display: "flex",
          background: `radial-gradient(circle, ${BRAND_GREEN} 0%, rgba(63,122,92,0) 70%)`,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -220,
          left: -160,
          width: 560,
          height: 560,
          borderRadius: 9999,
          display: "flex",
          background: `radial-gradient(circle, ${GOLD} 0%, rgba(245,185,66,0) 70%)`,
          opacity: 0.14,
        }}
      />
    </div>
  );
}

/** The rounded brand mark ("S.") reused from src/lib/brand-icon.tsx's design - a literal here since that file exports a JSX-building function scoped to icon routes, not a bare, reusable piece. */
function BrandMark() {
  return (
    <div
      style={{
        display: "flex",
        width: 52,
        height: 52,
        borderRadius: 14,
        background: `linear-gradient(155deg, ${BRAND_GREEN_BRIGHT} 0%, ${BRAND_GREEN} 100%)`,
        color: BASE_DARK,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 800,
        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
      }}
    >
      S.
    </div>
  );
}

/**
 * Top header row every card shares: brand mark + wordmark + an uppercase
 * "eyebrow" label naming what this card is (broadcast-lower-third style,
 * e.g. "РЕЗУЛЬТАТ МАТЧУ"), with an optional right-aligned pill for
 * per-card context (tournament name/round, "Підсумки сезону", etc).
 */
export function ShareCardHeader({
  eyebrow,
  pill,
}: {
  eyebrow: string;
  pill?: { title: string; subtitle?: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <BrandMark />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "flex", fontSize: 26, fontWeight: 700, color: WHITE }}>SET.club</span>
          <span style={{ display: "flex", fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: BRAND_GREEN_BRIGHT }}>
            {eyebrow}
          </span>
        </div>
      </div>
      {pill && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 3,
            padding: "10px 20px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.07)",
            border: `1px solid ${FAINT_BORDER}`,
          }}
        >
          <span style={{ display: "flex", fontSize: 20, fontWeight: 600, color: WHITE }}>{pill.title}</span>
          {pill.subtitle && <span style={{ display: "flex", fontSize: 15, color: MUTED }}>{pill.subtitle}</span>}
        </div>
      )}
    </div>
  );
}

/** Bottom row every card shares: a thin top divider, a left-aligned label, and the site URL on the right, marked by a small brand-green dot. */
export function ShareCardFooter({ left }: { left?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", height: 1, background: FAINT_BORDER }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 17 }}>
        <span style={{ display: "flex", color: MUTED }}>{left ?? ""}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", width: 6, height: 6, borderRadius: 3, background: BRAND_GREEN_BRIGHT }} />
          <span style={{ display: "flex", color: MUTED }}>set-club.vercel.app</span>
        </div>
      </div>
    </div>
  );
}

/** A round initials avatar - accent tone for a winner/leader, muted tone otherwise. Mirrors the app's own circular initial-letter avatar fallback (src/components/ui/avatar.tsx), simplified to what Satori can render. */
export function InitialAvatar({
  label,
  tone,
  size = 64,
}: {
  label: string;
  tone: "accent" | "muted";
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 800,
        flexShrink: 0,
        ...(tone === "accent"
          ? { background: `linear-gradient(155deg, ${GOLD} 0%, #d99522 100%)`, color: "#2b1a03" }
          : { background: "rgba(255,255,255,0.1)", color: MUTED, border: `1px solid ${FAINT_BORDER}` }),
      }}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}
