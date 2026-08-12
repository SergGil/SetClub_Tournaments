// Phone below is still a placeholder (docs/HOMEPAGE.md) - swap for the club's
// real number before shipping. Email is hidden entirely for now - the club
// doesn't have one yet; add it back once it exists.
const PHONE_PLACEHOLDER = "+380 XX XXX XX XX";
const PHONE_TEL = "tel:+380000000000";
const INSTAGRAM_URL = "https://www.instagram.com/setclub.ua";

export function HomeFooter() {
  return (
    <div className="border-t border-white/10 bg-neutral-950 px-6 py-7 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="flex items-center gap-1.5 text-sm font-extrabold">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            SET.club
          </span>
          <span className="text-sm text-white/50">Теніс · Кава · Падел — м. Південне, Одеська обл.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-white/50">
          <a href={PHONE_TEL} className="text-white/85 hover:text-white">
            {PHONE_PLACEHOLDER}
          </a>
        </div>

        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
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
