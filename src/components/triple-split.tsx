import { Coffee, HardHat, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Panel = {
  key: "coffee" | "tennis" | "padel";
  eyebrow: string;
  word: string;
  description: string;
  image: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

// Падел поки на Unsplash-плейсхолдері - немає фото будівництва корту, див.
// docs/HOMEPAGE.md.
const PANELS: Panel[] = [
  {
    key: "coffee",
    eyebrow: "Спешелті",
    word: "КАВА",
    description: "Спешелті кава та корисні сніданки в затишному просторі клубу.",
    image: "/split/coffee.jpg",
    icon: Coffee,
  },
  {
    key: "tennis",
    eyebrow: "Клуб",
    word: "ТЕНІС",
    description: "Ґрунтові корти та досвідчені тренери — турніри, рейтинг, тренування.",
    image: "/split/tennis.jpg",
    icon: Trophy,
  },
  {
    key: "padel",
    eyebrow: "У будівництві",
    word: "ПАДЕЛ",
    description: "Скоро відкриття. Будівництво сучасних кортів у розпалі.",
    image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1600&q=75",
    icon: HardHat,
  },
];

const CTA_CLASS =
  "pointer-events-auto mt-1 rounded-full border px-5 py-2 text-xs font-semibold opacity-100 transition-all duration-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100";

export function TripleSplit() {
  return (
    <div className="triple-split relative flex h-dvh min-h-[460px] flex-col md:flex-row">
      {PANELS.map((panel) => (
        <SplitPanel key={panel.key} panel={panel} />
      ))}
    </div>
  );
}

function SplitPanel({ panel }: { panel: Panel }) {
  const Icon = panel.icon;
  const isPadel = panel.key === "padel";
  const isTennis = panel.key === "tennis";

  return (
    <div className="split-panel group relative flex min-w-0 items-center justify-center overflow-hidden border-b border-white/10 text-center last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/45" />

      {isTennis && (
        <Link href="/tennis" aria-label="Теніс — перейти на сторінку клубу" className="absolute inset-0 z-10">
          <span className="sr-only">Теніс</span>
        </Link>
      )}

      {isPadel && (
        <Badge className="absolute top-6 left-1/2 z-20 -translate-x-1/2 tracking-wide uppercase">
          Coming Soon
        </Badge>
      )}

      <div className="relative z-20 flex flex-col items-center gap-2 px-6 pointer-events-none">
        <span className="text-[0.68rem] font-medium tracking-[0.16em] text-white/70 uppercase">
          {panel.eyebrow}
        </span>
        <Icon className="size-6 text-white/80" aria-hidden />
        <div className="text-[clamp(2.4rem,9vw,5.5rem)] leading-[0.95] font-extrabold tracking-tight text-white">
          {panel.word}
        </div>
        <p className="max-w-[34ch] text-sm text-white/70 opacity-100 transition-all duration-300 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          {panel.description}
        </p>

        {panel.key === "coffee" && (
          <Link
            href="/coffee"
            className={cn(CTA_CLASS, "border-white/35 text-white hover:border-primary hover:bg-primary hover:text-primary-foreground")}
          >
            Menu кав&apos;ярні
          </Link>
        )}

        {isTennis && (
          <Link
            href="/tennis/pricing"
            className={cn(CTA_CLASS, "border-white/35 text-white hover:border-primary hover:bg-primary hover:text-primary-foreground")}
          >
            Забронювати корт
          </Link>
        )}

        {isPadel && (
          <span
            aria-disabled="true"
            className={cn(CTA_CLASS, "cursor-not-allowed border-white/15 text-white/50 md:group-hover:opacity-70")}
          >
            Незабаром
          </span>
        )}
      </div>
    </div>
  );
}
