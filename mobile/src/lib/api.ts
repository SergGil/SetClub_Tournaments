import { loadSession } from '@/lib/session-storage';

/**
 * The `next dev` server bound on the dev machine - a physical device/emulator
 * can't resolve `localhost` to the machine running Metro, so this has to be a
 * LAN IP (or an Expo tunnel URL) reachable from the phone. Set it in
 * mobile/.env as EXPO_PUBLIC_API_BASE_URL - see docs/MOBILE_APP.md.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/** Mirrors the `{ error, fieldErrors?, cascadeResets? }` shape every /api/v1/** route returns on failure (src/lib/api-auth.ts::withApiErrorHandling + each xxxCore's own {error} returns). */
type ApiErrorBody = { error?: string; fieldErrors?: Record<string, string>; cascadeResets?: unknown };

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  );
}

/** Reads a failure body defensively: anything that isn't the server's JSON error object (an HTML error page from a proxy, a JSON array) becomes `{}`, so ApiError falls back to the status message. */
function toApiErrorBody(data: unknown): ApiErrorBody {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
  const body = data as Record<string, unknown>;
  return {
    error: typeof body.error === 'string' ? body.error : undefined,
    fieldErrors: isStringRecord(body.fieldErrors) ? body.fieldErrors : undefined,
    cascadeResets: body.cascadeResets,
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  readonly cascadeResets?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error ?? `Request failed with status ${status}`);
    this.status = status;
    this.fieldErrors = body.fieldErrors;
    this.cascadeResets = body.cascadeResets;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip attaching the bearer token - only auth/google needs this (no session yet). */
  skipAuth?: boolean;
};

/**
 * Set by AuthProvider (auth-context.tsx) on mount - the one place that owns
 * `session` state and can actually clear it. A plain module-level callback
 * rather than importing AuthProvider here, since this file has no React
 * context of its own to hook into and every screen already goes through
 * apiRequest for every read/write.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * Thin fetch wrapper for every /api/v1/** call: attaches the bearer session
 * token (see src/lib/permissions.ts::resolveSession on the server side, which
 * accepts this same `Authorization: Bearer <sessionToken>` header), and
 * throws ApiError with the server's own error shape on failure so screens can
 * show the same messages the web admin forms do.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  let hadToken = false;
  if (!options.skipAuth) {
    const session = await loadSession();
    if (session) {
      headers.Authorization = `Bearer ${session.sessionToken}`;
      hadToken = true;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // A 401 with no token attached just means "this needs sign-in", not "the
    // session died" - there's no session to clear and the UI never should
    // have offered this action signed-out in the first place. Only a 401
    // *with* a bearer token attached means the token itself is no longer
    // valid (expired/revoked server-side, see resolveSession's own `expires`
    // check) - that's the case AuthProvider needs to react to. The server's
    // require* guards answer a missing/expired session with 401 on admin
    // routes too (403 only means "signed in, but no rights").
    if (response.status === 401 && hadToken) onSessionExpired?.();
    throw new ApiError(response.status, toApiErrorBody(data));
  }
  return data as T;
}

/**
 * For the writes that can stop to ask "this resets results further down the
 * bracket - confirm?" (score save, match edit/delete, withdrawal). The server
 * sends that question as a 400 carrying `cascadeResets`, which apiRequest
 * throws like any other failure - so the screens' "ask, then retry with
 * acknowledgedCascadeReset" branch never ran. This hands that one answer back
 * as a value instead; every other failure still throws.
 */
export async function apiRequestWithCascade<T, CascadeItem>(
  path: string,
  options: RequestOptions = {},
): Promise<T | { error: string; cascadeResets: CascadeItem[] }> {
  try {
    return await apiRequest<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && Array.isArray(err.cascadeResets) && err.cascadeResets.length > 0) {
      return { error: err.message, cascadeResets: err.cascadeResets as CascadeItem[] };
    }
    throw err;
  }
}
