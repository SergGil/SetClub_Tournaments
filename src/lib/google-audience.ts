/**
 * The OAuth client ids a Google ID token may be issued to, for
 * POST /api/v1/auth/google. The mobile app signs in with its own iOS/Android
 * client (EXPO_PUBLIC_GOOGLE_CLIENT_ID, docs/MOBILE_APP.md), and Google puts
 * THAT client's id in the token's `aud` - checking only the web client
 * (AUTH_GOOGLE_ID) would reject every mobile sign-in. The mobile ids come from
 * AUTH_GOOGLE_MOBILE_CLIENT_IDS (comma-separated, one per platform).
 *
 * Empty when AUTH_GOOGLE_ID itself is missing: without any audience
 * verifyIdToken would accept a token minted for ANY Google client, so the
 * route refuses to sign anyone in instead.
 */
export function googleTokenAudiences(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const web = env.AUTH_GOOGLE_ID?.trim();
  if (!web) return [];
  const mobile = (env.AUTH_GOOGLE_MOBILE_CLIENT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return [web, ...mobile];
}
