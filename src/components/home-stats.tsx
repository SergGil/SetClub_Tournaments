import { DIRECTION_FORMS, MATCH_FORMS, pluralizeUk, PLAYER_FORMS, TOURNAMENT_FORMS } from "@/lib/pluralize";
import type { HomeStats as HomeStatsData } from "@/lib/queries/home-stats";

// Static, not a DB fact - the club has exactly 3 public directions (Tennis/
// Coffee/Padel, AdminDomain enum), no table to count that against.
const CLUB_DIRECTIONS = 3;

export function HomeStats({ stats }: { stats: HomeStatsData }) {
  // The label's word has to agree with its own count (22 турніри, not
  // "22 турнірів" - see pluralizeUk) - hardcoding one plural form broke for
  // every count outside the "5+" bucket (e.g. showed "43 ГРАВЦІВ" instead of
  // "43 ГРАВЦІ"), which is most counts a growing club will ever actually hit.
  const items = [
    { value: stats.tournamentsCount, label: `${pluralizeUk(stats.tournamentsCount, TOURNAMENT_FORMS)} зіграно` },
    { value: stats.playersCount, label: `${pluralizeUk(stats.playersCount, PLAYER_FORMS)} у клубі` },
    { value: stats.matchesCount, label: `${pluralizeUk(stats.matchesCount, MATCH_FORMS)} у базі` },
    { value: CLUB_DIRECTIONS, label: `${pluralizeUk(CLUB_DIRECTIONS, DIRECTION_FORMS)} клубу` },
  ];

  return (
    // The dark backdrop lives on its own wrapper, never on the animated
    // element itself - scroll-reveal (globals.css) fades the grid's opacity
    // 0 -> 1, and an element's opacity animates its background too, so a
    // bg-neutral-950 directly on the fading element turned briefly
    // translucent mid-animation, showing the light page background behind
    // it right through the "black" stats strip.
    <div className="bg-neutral-950 px-8 py-16 sm:px-14">
      {/* scroll-reveal: progressive enhancement via `animation-timeline:
          view()` - browsers without it (Firefox, older Safari) just render
          the grid normally, no JS fallback needed. */}
      <div className="scroll-reveal grid grid-cols-2 gap-6 text-white sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5 border-t border-white/15 pt-6">
            <div
              className="text-5xl text-home-accent sm:text-6xl"
              style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
            >
              {item.value}
            </div>
            <div className="text-xs font-semibold tracking-[0.12em] text-white/55 uppercase">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
