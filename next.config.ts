import type { NextConfig } from "next";

// No Proxy-generated nonce (see src/proxy.ts - it's kept deliberately cheap,
// cookie-presence-only, not a place to also compute a per-request nonce), so
// this stays 'unsafe-inline' rather than nonce-based: layout.tsx has two
// beforeInteractive inline <Script> tags (theme/background-photo init, must
// run before paint to avoid a flash of the wrong theme) and several
// components use inline `style={{...}}` (chart gradients, avatar init etc.).
// Still meaningfully narrows the attack surface vs. no CSP at all - blocks
// any *externally hosted* script/style/frame injection, which is the
// dominant XSS payload shape.
// connect-src's r2.cloudflarestorage.com is the presigned-PUT upload target
// the browser fetches directly (src/components/admin/photo-upload-dialog.tsx)
// - separate from img-src's r2.dev below, which is only for *reading* photos
// back (see src/lib/r2.ts, docs/PHOTOS.md).
// The one R2 public host photos are served from (R2_PUBLIC_URL, the same value
// publicPhotoUrl() builds every photo URL from). Pinned to that host rather than "*.r2.dev" so
// the image optimizer (/_next/image) and the CSP can't be used to proxy or load anyone else's
// bucket. Falls back to the wildcard only when the variable isn't set at build time (e.g. CI).
function r2PublicHostname(): string {
  try {
    return new URL(process.env.R2_PUBLIC_URL ?? "").hostname || "*.r2.dev";
  } catch {
    return "*.r2.dev";
  }
}
const R2_HOST = r2PublicHostname();

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.googleusercontent.com https://${R2_HOST} https://images.unsplash.com data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://*.r2.cloudflarestorage.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

// An Accept header that mentions Markdown at all - src/proxy.ts then decides,
// by q-value, whether the homepage serves its Markdown copy. Same pattern as
// the proxy matcher there. Next anchors `has`/`missing` values (^...$).
const ACCEPT_MARKDOWN = ".*text/markdown.*";

// `cacheComponents: true` is deliberately NOT set here - investigated and
// reverted (separate session, no code from it survived; see
// docs/CACHE_COMPONENTS.md for the full writeup).
//
// The trigger: src/components/nav.tsx calls auth() (a Request-time API) on
// every single page via the root layout, which forces every route in the
// app fully dynamic - `next build`'s route list has zero `○ Static`
// entries besides /icon-type routes. Next 16 removed the standalone
// `experimental_ppr` escape hatch (a Suspense boundary alone no longer
// unlocks a static shell) - the only way to get that back is
// `cacheComponents: true`.
//
// Enabling it is NOT the small "wrap Nav in Suspense" fix it sounds like:
// under Cache Components, literally every Prisma call becomes "dynamic by
// default," and empirically (tested against this exact DB setup) most of
// them fail the *build* outright, not just a soft validation warning -
// `@neondatabase/serverless`'s SASL/SCRAM-SHA-256 handshake calls
// `crypto.randomBytes` for its client nonce on every fresh connection,
// which Next's prerender flags as non-deterministic and refuses to defer
// (`instant = false` does NOT suppress this class of error, only the
// "won't render instantly" insight class). Confirmed a `'use cache'`
// wrapper around a query function does work around it - but that means
// every query function across src/lib/queries, src/lib/rating,
// tournament-standings.ts etc. (several dozen) needs one, each with a
// deliberately chosen cacheTag wired into the ~90 existing
// revalidatePath/updateTag(STATS_CACHE_TAG) call sites so admin edits
// still show up immediately - a real multi-session migration, not a
// config flip.
//
// Decided not worth it at the club's actual scale: the payoff is ~50-150ms
// per cached page load (DB round-trip skipped) - real, but nobody notices
// it at a few hundred visitors. The cost is that migration effort plus a
// genuinely new bug class this app doesn't have today (a mis-tagged cache
// silently serving a stale score/standings after an admin edit) in trade
// for a speed difference nobody will feel. Revisit only if traffic grows
// enough that this trade-off's math actually changes (order-of-magnitude
// more visitors, not just "the club grew a bit") - not a fixed number, a
// judgment call for whenever it comes up again.
const nextConfig: NextConfig = {
  images: {
    // Tournament photos in Cloudflare R2, served from the bucket's public
    // r2.dev subdomain (see src/lib/r2.ts, docs/PHOTOS.md). Update this
    // (and img-src above) if the bucket later moves to a custom domain.
    remotePatterns: [
      { protocol: "https", hostname: R2_HOST, pathname: "/**" },
      // Placeholder background photos for the triple-split homepage
      // (docs/HOMEPAGE.md) until the club has real photography.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Points AI agents at the machine-readable versions of the homepage
        // (RFC 8288; docs/SEO.md, "AI-готовність"). Next appends React's own
        // font/CSS preload Link values to the same response rather than
        // replacing this one. Relative targets resolve against the page URL.
        // Skipped whenever Accept mentions Markdown (src/proxy.ts may then
        // serve /index.md itself, where it is the document, not an alternate,
        // and its own `rel="canonical"` Link should be the only one - locally
        // Next drops a handler's header when config already set the same key).
        // So a client that lists Markdown but prefers HTML gets HTML without
        // this header - it has said it doesn't want the alternate anyway.
        source: "/",
        missing: [{ type: "header", key: "accept", value: ACCEPT_MARKDOWN }],
        headers: [
          {
            key: "Link",
            value: '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"',
          },
        ],
      },
      {
        // `/` answers with HTML or Markdown depending on Accept (src/proxy.ts),
        // so a cache keyed only on the URL could hand one to a client
        // that asked for the other. Reaches the Markdown variant (merged with
        // the route's own Vary). On the HTML variant Next's app-page render
        // overwrites Vary with its RSC list (res.setHeader in
        // app-page-runtime.js), so it may not survive there - harmless while
        // the homepage is `Cache-Control: private, no-store`, which no shared
        // cache stores. Revisit if `/` ever becomes cacheable (ISR, use cache).
        source: "/",
        headers: [{ key: "Vary", value: "Accept" }],
      },
    ];
  },
  async rewrites() {
    return [
      // There is no app/favicon.ico (see src/app/icon.tsx for why); pages
      // declare their icons with <link rel="icon">, but browsers on non-HTML
      // documents (llms.txt, index.md) and some link-preview bots still ask
      // for /favicon.ico blindly. Serve them the small tab icon instead of a
      // 404 - a PNG under an .ico name, which every browser accepts.
      { source: "/favicon.ico", destination: "/icon/small" },
    ];
  },
};

export default nextConfig;
