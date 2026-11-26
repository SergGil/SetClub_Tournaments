import Image from "next/image";

import { HERO_GLOW_GRADIENT } from "@/components/page-hero-glow";
import { sectionPageMetadata, SECTION_SEO } from "@/lib/section-seo";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/site";
import { TENNIS_COACHES } from "@/lib/tennis-coaches";

export const metadata = sectionPageMetadata(SECTION_SEO.coaches);

export default function CoachesPage() {
  return (
    <div
      className="relative left-1/2 right-1/2 -mx-[50vw] -my-8 w-screen bg-background px-6 py-16 text-foreground"
      style={{ backgroundImage: HERO_GLOW_GRADIENT.tennis, backgroundAttachment: "fixed" }}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Теніс</p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Тренери клубу
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TENNIS_COACHES.map((coach) => (
            <div key={coach.name} className="flex flex-col gap-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <Image
                  src={coach.photo}
                  alt={coach.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="text-sm font-semibold">{coach.name}</div>
              {coach.bio.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {coach.bio.map((line) => (
                    <li key={line} className="text-xs text-muted-foreground">
                      • {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border px-8 py-10 text-center">
          <p className="text-lg font-medium text-foreground/90">
            Запис на тренування здійснюється виключно за телефоном клубу:
          </p>
          <a
            href={SITE_PHONE_TEL}
            className="mt-2 inline-block text-2xl font-bold tracking-tight text-foreground underline underline-offset-4 hover:text-primary"
          >
            {SITE_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}
