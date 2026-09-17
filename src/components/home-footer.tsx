import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/site";

// Email is hidden entirely for now - the club doesn't have one yet; add it
// back once it exists.
const INSTAGRAM_URL = "https://www.instagram.com/setclub.ua";

export function HomeFooter() {
  return (
    <div className="relative bg-neutral-950 px-6 py-7 text-white">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary) 30%, var(--home-accent) 55%, var(--primary) 80%, transparent)",
        }}
        aria-hidden
      />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className="flex items-center gap-1.5 text-sm font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            SET.club
          </span>
          <span className="text-sm text-white/50">Теніс · Кава · Падел — м. Південне, Одеська обл.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-white/50">
          <a href={SITE_PHONE_TEL} className="text-white/85 hover:text-white">
            {SITE_PHONE}
          </a>
        </div>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:border-home-accent hover:bg-home-accent hover:text-home-accent-ink"
          aria-label="Instagram SET.club"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
          </svg>
        </a>
      </div>
    </div>
  );
}
