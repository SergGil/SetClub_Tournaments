import Link from "next/link";

import { formatLongDateKyiv } from "@/lib/date-format";
import { HOME_FAQ, HOME_INTRO, HOME_TITLE } from "@/lib/home-about";

/**
 * The homepage's only real prose: an <h1>, an intro and short question/answer
 * pairs, all server-rendered (docs/SEO.md, "AI-готовність"). The rest of `/`
 * is photos and numbers, which left AI/search crawlers with ~125 words and no
 * heading to quote. Copy lives in lib/home-about.ts, shared with the Markdown
 * version at /index.md. Each <p> sits directly under its heading on purpose -
 * answer engines quote the paragraph that follows a question.
 */
export function HomeAbout({ updatedAt }: { updatedAt: Date | null }) {
  return (
    <section className="border-t border-white/10 bg-neutral-950 px-8 py-16 text-white sm:px-14">
      <div className="mx-auto max-w-6xl">
        <h1
          className="max-w-4xl text-3xl leading-tight font-extrabold sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {HOME_TITLE}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">{HOME_INTRO}</p>
        {updatedAt && (
          <p className="mt-4 text-xs tracking-wide text-white/45">
            Оновлено <time dateTime={updatedAt.toISOString()}>{formatLongDateKyiv(updatedAt)}</time>
          </p>
        )}

        {/* scroll-reveal: same progressive-enhancement fade as HomeStats -
            the text is in the HTML either way, only the entrance animates. */}
        <div className="scroll-reveal mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {HOME_FAQ.map((item) => (
            <div key={item.question} className="flex flex-col gap-2.5 border-t border-white/15 pt-5">
              <h2 className="text-lg leading-snug font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {item.question}
              </h2>
              <p className="text-sm leading-relaxed text-white/65">{item.answer}</p>
              {item.link && (
                <Link href={item.link.href} className="mt-auto text-sm font-semibold text-home-accent hover:underline">
                  {item.link.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
