import type { HomeStats as HomeStatsData } from "@/lib/queries/home-stats";

// Static, not a DB fact - the club has exactly 3 public directions (Tennis/
// Coffee/Padel, AdminDomain enum), no table to count that against.
const CLUB_DIRECTIONS = 3;

export function HomeStats({ stats }: { stats: HomeStatsData }) {
  const items = [
    { value: stats.tournamentsCount, label: "ТУРНІРІВ ЗІГРАНО" },
    { value: stats.playersCount, label: "ГРАВЦІВ У КЛУБІ" },
    { value: stats.matchesCount, label: "МАТЧІВ У БАЗІ" },
    { value: CLUB_DIRECTIONS, label: "НАПРЯМКИ КЛУБУ" },
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
            <div className="text-xs font-semibold tracking-[0.12em] text-white/55">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
