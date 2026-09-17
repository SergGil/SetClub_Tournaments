import { Coffee, HardHat, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import type { AdminDomain } from "@/generated/prisma/enums";
import type { HomePanelText } from "@/lib/queries/home-panels";
import { cn } from "@/lib/utils";

type PanelMeta = {
  key: "coffee" | "tennis" | "padel";
  domain: AdminDomain;
  image: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

// Eyebrow/title/description live in the DB now (editable at /admin/home,
// see lib/queries/home-panels.ts) - only the non-text bits stay hardcoded
// here. Падел поки на Unsplash-плейсхолдері - немає фото будівництва
// корту, див. docs/HOMEPAGE.md.
const PANELS: PanelMeta[] = [
  { key: "coffee", domain: "COFFEE", image: "/split/coffee.jpg", icon: Coffee },
  { key: "tennis", domain: "TENNIS", image: "/split/tennis.jpg", icon: Trophy },
  {
    key: "padel",
    domain: "PADEL",
    image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1600&q=75",
    icon: HardHat,
  },
];

const CTA_CLASS =
  "pointer-events-auto mt-1 rounded-full border px-5 py-2 text-xs font-semibold opacity-100 transition-all duration-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100";

export function TripleSplit({
  padelAuthorized,
  panelText,
}: {
  padelAuthorized: boolean;
  panelText: Record<AdminDomain, HomePanelText>;
}) {
  return (
    <div className="triple-split relative flex h-dvh min-h-[460px] flex-col md:flex-row">
      {PANELS.map((panel) => (
        <SplitPanel
          key={panel.key}
          panel={panel}
          text={panelText[panel.domain]}
          padelAuthorized={padelAuthorized}
        />
      ))}
    </div>
  );
}

function SplitPanel({
  panel,
  text,
  padelAuthorized,
}: {
  panel: PanelMeta;
  text: HomePanelText;
  padelAuthorized: boolean;
}) {
  const Icon = panel.icon;
  const isPadel = panel.key === "padel";
  const isTennis = panel.key === "tennis";
  // Still "Coming Soon" visually for everyone (docs/HOMEPAGE.md) - but a
  // superadmin/PADEL-domain admin gets a real entry point here instead of
  // having to type the /padel URL by hand.
  const padelClickable = isPadel && padelAuthorized;

  return (
    <div className="split-panel group relative flex min-w-0 items-center justify-center overflow-y-auto overflow-x-hidden border-b border-white/10 text-center last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={panel.image}
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
          className={cn(
            "object-cover transition-transform duration-500 ease-in-out group-hover:scale-105",
            isPadel && "opacity-40 grayscale",
          )}
        />
      </div>
      <div className="hero-grain absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/45" />

      {isTennis && (
        <Link href="/tennis" aria-label="Теніс — перейти на сторінку клубу" className="absolute inset-0 z-10">
          <span className="sr-only">Теніс</span>
        </Link>
      )}

      {/* Tennis/Padel already get this full-panel overlay; Coffee didn't,
          leaving "Меню кав'ярні" — a CTA that's opacity-0 until :hover from
          md: up (see CTA_CLASS) — the *only* way into /coffee on any hover-less
          pointer (tablets, touch laptops, landscape phones ≥768px). The panel
          itself is now always tappable, same as its siblings; the CTA stays
          as a visible affordance below md: and a hover bonus above it. */}
      {panel.key === "coffee" && (
        <Link href="/coffee" aria-label="Кава — перейти на сторінку кав'ярні" className="absolute inset-0 z-10">
          <span className="sr-only">Кава</span>
        </Link>
      )}

      {padelClickable && (
        <Link href="/padel" aria-label="Падел — перейти на сторінку розділу (адмін)" className="absolute inset-0 z-10">
          <span className="sr-only">Падел</span>
        </Link>
      )}

      {isPadel && (
        <Badge className="absolute top-6 left-1/2 z-20 -translate-x-1/2 gap-1.5 bg-home-accent tracking-wide text-home-accent-ink uppercase">
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-home-accent-ink" aria-hidden />
          Coming Soon
        </Badge>
      )}

      <div className="relative z-20 flex flex-col items-center gap-2 px-6 pointer-events-none">
        {text.eyebrow && (
          <span className="border-b border-home-accent pb-1 font-mono text-[0.68rem] font-medium tracking-[0.16em] text-white/75 uppercase">
            {text.eyebrow}
          </span>
        )}
        <Icon className="size-6 text-white/80" aria-hidden />
        <div
          className="text-[clamp(2.4rem,9vw,5.5rem)] leading-[0.94] font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {text.title}
        </div>
        {text.description && (
          <p className="max-w-[34ch] text-sm text-white/70 opacity-100 transition-all duration-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
            {text.description}
          </p>
        )}

        {panel.key === "coffee" && (
          <Link
            href="/coffee"
            className={cn(CTA_CLASS, "border-white/35 text-white hover:border-home-accent hover:bg-home-accent hover:text-home-accent-ink")}
          >
            Меню кав&apos;ярні
          </Link>
        )}

        {isTennis && (
          <Link
            href="/tennis/pricing"
            className={cn(CTA_CLASS, "border-white/35 text-white hover:border-home-accent hover:bg-home-accent hover:text-home-accent-ink")}
          >
            Забронювати корт
          </Link>
        )}

        {isPadel && !padelAuthorized && (
          <span
            aria-disabled="true"
            className={cn(CTA_CLASS, "cursor-not-allowed border-white/15 text-white/50 md:group-hover:opacity-70")}
          >
            Незабаром
          </span>
        )}

        {padelClickable && (
          <Link
            href="/padel"
            className={cn(CTA_CLASS, "border-white/35 text-white hover:border-home-accent hover:bg-home-accent hover:text-home-accent-ink")}
          >
            Переглянути (адмін)
          </Link>
        )}
      </div>
    </div>
  );
}
