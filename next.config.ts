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
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.googleusercontent.com https://*.r2.dev https://images.unsplash.com data: blob:;
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
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
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
    ];
  },
};

export default nextConfig;
