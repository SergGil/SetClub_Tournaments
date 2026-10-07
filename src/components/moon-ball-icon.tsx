/**
 * A tennis ball that doubles as a moon: round outline, one tennis seam on
 * the left, and a filled crescent on the right - the "Blue Moon" badges
 * (docs/ACHIEVEMENTS.md). Sized/colored like a lucide icon: stroke and fill
 * follow `currentColor`, so a text-* class tints it. Mobile twin:
 * mobile/src/components/moon-ball-icon.tsx.
 */
export function MoonBallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M5.8 5.8C9 8.7 9 15.3 5.8 18.2" />
      <path d="M12 3A9 9 0 0 1 12 21A5 9 0 0 0 12 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
