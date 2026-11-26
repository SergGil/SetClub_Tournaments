import { HOME_FAQ, HOME_INTRO, HOME_TITLE } from "@/lib/home-about";
import { SITE_ALTERNATE_NAMES, SITE_DESCRIPTION, SITE_NAME, SITE_PHONE_TEL, SOCIAL_PROFILES } from "@/lib/site";

/**
 * schema.org JSON-LD for the homepage (src/app/page.tsx): who runs the site
 * (Organization), the site itself (WebSite, published by that Organization)
 * and the homepage (with its last-updated date). One @graph so the three
 * nodes reference each other by @id instead of repeating themselves.
 *
 * The homepage node is an FAQPage (a WebPage subtype, so every WebPage
 * property still applies) because HomeAbout shows question/answer pairs:
 * answer engines read mainEntity as ready-made Q&A. It's built from the same
 * HOME_FAQ the page renders, since schema.org/Google require the markup to
 * match the visible text exactly.
 *
 * Plain Organization rather than SportsClub/LocalBusiness on purpose: those
 * only pay off with a street address and geo coordinates, which the site
 * doesn't publish yet. Its `name` must stay exactly SITE_NAME - the same
 * string as og:site_name and the start of the homepage <title>, so search/AI
 * engines read them as one entity.
 */
export function buildHomeJsonLd({ siteUrl, dateModified }: { siteUrl: string; dateModified: Date | null }) {
  const home = `${siteUrl}/`;
  const orgId = `${home}#org`;
  const websiteId = `${home}#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: SITE_NAME,
        url: home,
        // The 512px PWA icon (src/app/manifest-icons/[size]) - Google wants a logo of at least 112px.
        logo: { "@type": "ImageObject", url: `${siteUrl}/manifest-icons/512`, width: 512, height: 512 },
        description: SITE_DESCRIPTION,
        telephone: SITE_PHONE_TEL.replace(/^tel:/, ""),
        address: {
          "@type": "PostalAddress",
          addressLocality: "Південне",
          addressRegion: "Одеська область",
          addressCountry: "UA",
        },
        sameAs: SOCIAL_PROFILES.map((profile) => profile.url),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: home,
        // Google's site name (the line above the result's title) comes from here.
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES, new URL(siteUrl).host],
        inLanguage: "uk",
        publisher: { "@id": orgId },
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#webpage`,
        url: home,
        name: HOME_TITLE,
        description: HOME_INTRO,
        inLanguage: "uk",
        isPartOf: { "@id": websiteId },
        about: { "@id": orgId },
        author: { "@id": orgId },
        publisher: { "@id": orgId },
        ...(dateModified && { dateModified: dateModified.toISOString() }),
        mainEntity: HOME_FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<` is escaped so a
 * string containing `</script>` can't close the tag early (the XSS caveat in
 * node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
 */
export function jsonLdScriptContent(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
