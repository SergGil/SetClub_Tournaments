import { HOME_INTRO, HOME_TITLE } from "@/lib/home-about";
import { SITE_DESCRIPTION, SITE_NAME, SITE_PHONE_TEL, SOCIAL_PROFILES } from "@/lib/site";

/**
 * schema.org JSON-LD for the homepage (src/app/page.tsx): who runs the site
 * (Organization), the site itself (WebSite, published by that Organization)
 * and the homepage (WebPage, with its last-updated date). One @graph so the
 * three nodes reference each other by @id instead of repeating themselves.
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
        name: SITE_NAME,
        inLanguage: "uk",
        publisher: { "@id": orgId },
      },
      {
        "@type": "WebPage",
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
