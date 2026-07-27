/**
 * Full-bleed square, no rounding or transparency — iOS/Android apply their
 * own mask (rounded square, circle, squircle) on top. A circle here would
 * leave the corners transparent, which iOS renders as solid black.
 */
export function brandIconElement(size: number) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#3f7a5c",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: size * 0.24, fontWeight: 700, lineHeight: 1 }}>SET.</div>
      <div style={{ fontSize: size * 0.16, fontWeight: 400, lineHeight: 1, marginTop: size * 0.02 }}>
        club
      </div>
    </div>
  );
}
