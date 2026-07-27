export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Set Club"
      className="shrink-0"
    >
      <circle cx="50" cy="50" r="48" fill="var(--primary)" />
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontWeight="700"
        fontSize="24"
        fill="var(--primary-foreground)"
      >
        SET.
      </text>
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontWeight="400"
        fontSize="16"
        fill="var(--primary-foreground)"
      >
        club
      </text>
    </svg>
  );
}
