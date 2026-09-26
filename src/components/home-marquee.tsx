import { Sparkle } from "lucide-react";
import Link from "next/link";

// Homepage-only chrome between TripleSplit and HomeStats - a curated list of
// the club's public sections, close to NAV_LINKS (site.ts) but hand-picked
// for a marketing ticker rather than importing that list wholesale (it also
// carries admin-adjacent entries this ticker doesn't need).
const MARQUEE_ITEMS = [
  { label: "ТЕНІС", href: "/tennis" },
  { label: "КАВА", href: "/coffee" },
  { label: "ПАДЕЛ", href: "/padel" },
  { label: "ТУРНІРИ", href: "/tournaments" },
  { label: "РЕЙТИНГ", href: "/rating" },
  { label: "ГРАВЦІ", href: "/players" },
  { label: "ШКОЛА", href: "/tennis/school" },
  { label: "ЦІНИ", href: "/tennis/pricing" },
  { label: "ТРЕНЕРИ", href: "/tennis/coaches" },
  { label: "НОВИНИ", href: "/news" },
  { label: "ФОТО", href: "/gallery" },
] as const;

// Doubled so the `-50%` translateX loop (animate-marquee, globals.css)
// wraps seamlessly - the visible track is always exactly one full copy wide.
const TRACK_ITEMS = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

export function HomeMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-neutral-950 py-6">
      <div className="animate-marquee flex w-max hover:[animation-play-state:paused]">
        {TRACK_ITEMS.map((item, i) => (
          <Link
            key={`${item.href}-${i}`}
            href={item.href}
            className="flex items-center gap-4 px-6 transition-[filter,transform] duration-300 hover:scale-[1.06] hover:brightness-125"
          >
            <span
              className="text-2xl tracking-wide"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                backgroundImage:
                  i % 2 === 0
                    ? "linear-gradient(90deg, var(--home-accent), white)"
                    : "linear-gradient(90deg, white, var(--home-accent))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {item.label}
            </span>
            <Sparkle className="size-4 shrink-0 animate-spin text-home-accent [animation-duration:7s]" aria-hidden />
          </Link>
        ))}
      </div>

      {/* Glass-blur fade at both edges instead of a hard opacity cutoff.
          `backdropFilter` gets both prefixes by hand (not just Tailwind's
          `backdrop-blur-md`) - Safari still needs `-webkit-backdrop-filter`
          alongside the unprefixed property, and combined with mask-image it's
          a spot Safari has historically been inconsistent on, so this
          degrades to a plain hard edge there rather than breaking anything. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-36"
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          WebkitMaskImage: "linear-gradient(to right, #000, transparent)",
          maskImage: "linear-gradient(to right, #000, transparent)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-36"
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          WebkitMaskImage: "linear-gradient(to left, #000, transparent)",
          maskImage: "linear-gradient(to left, #000, transparent)",
        }}
        aria-hidden
      />
    </div>
  );
}
