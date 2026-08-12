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
