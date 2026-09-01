import { loadSession } from '@/lib/session-storage';

/**
 * The `next dev` server bound on the dev machine - a physical device/emulator
 * can't resolve `localhost` to the machine running Metro, so this has to be a
 * LAN IP (or an Expo tunnel URL) reachable from the phone. Set it in
 * mobile/.env as EXPO_PUBLIC_API_BASE_URL - see docs/MOBILE_APP.md.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/** Mirrors the `{ error, fieldErrors?, cascadeResets? }` shape every /api/v1/** route returns on failure (src/lib/api-auth.ts::withApiErrorHandling + each xxxCore's own {error} returns). */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;
  readonly cascadeResets?: unknown;

  constructor(status: number, body: { error?: string; fieldErrors?: Record<string, string>; cascadeResets?: unknown }) {
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
 * Thin fetch wrapper for every /api/v1/** call: attaches the bearer session
 * token (see src/lib/permissions.ts::resolveSession on the server side, which
 * accepts this same `Authorization: Bearer <sessionToken>` header), and
 * throws ApiError with the server's own error shape on failure so screens can
 * show the same messages the web admin forms do.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!options.skipAuth) {
    const session = await loadSession();
    if (session) headers.Authorization = `Bearer ${session.sessionToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiError(response.status, data ?? {});
  }
  return data as T;
}
