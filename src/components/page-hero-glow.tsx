/**
 * Full-bleed radial glow behind a page's title - same visual language as the
 * homepage triple-split (src/components/triple-split.tsx), piloted first on
 * /rating (see docs/CHANGELOG.md). Fixed + full viewport width (not a boxed
 * panel) so it sits behind the header too and fades out before the page's
 * actual content (table/list), which stays on the plain background.
 *
 * "tennis" (default) reuses --primary/--home-accent, the app's existing
 * green/lime pair. "padel" swaps the second color for --compare-secondary
 * (the existing blue used to tell two rating lines apart on the compare
 * chart) so the Padel section reads as visually distinct without inventing
 * a brand-new color. Both share the same top-left primary blob - only the
 * top-right accent blob's color differs - so that one's kept factored out
 * rather than duplicated per variant.
 *
 * HERO_GLOW_GRADIENT is exported (not just used internally) so pages that
 * already paint their own opaque background on the hero wrapper
 * (tennis/school, tennis/pricing, tennis/coaches - the "relative
 * -mx-[50vw] w-screen bg-background" full-bleed pattern) can layer this
 * gradient directly into that element's own background-image instead of
 * using <PageHeroGlow>'s fixed overlay, which would otherwise paint
 * *behind* their solid bg-background and never show.
 */
const PRIMARY_BLOB = "radial-gradient(1100px 560px at 8% -20%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 60%)";

export const HERO_GLOW_GRADIENT = {
  tennis: `${PRIMARY_BLOB}, radial-gradient(900px 480px at 96% -15%, color-mix(in oklch, var(--home-accent) 16%, transparent), transparent 55%)`,
  padel: `${PRIMARY_BLOB}, radial-gradient(900px 480px at 96% -15%, color-mix(in oklch, var(--compare-secondary) 20%, transparent), transparent 55%)`,
} as const;

export function PageHeroGlow({ variant = "tennis" }: { variant?: keyof typeof HERO_GLOW_GRADIENT }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[560px]"
      style={{ backgroundImage: HERO_GLOW_GRADIENT[variant] }}
    />
  );
}
