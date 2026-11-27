/**
 * Typed access to JSON request bodies in the API routes. `request.json()` is typed `any`, which let
 * every `body.x` access skip type checking; these helpers hand the routes `unknown` values instead,
 * so the narrowing each route already does by hand (`typeof`, `=== true`, `Array.isArray`) is the
 * thing the compiler checks.
 */

/** A parsed JSON object body. Every value is `unknown` until a route narrows it. */
export type JsonBody = Readonly<Record<string, unknown>>;

function isJsonObject(value: unknown): value is JsonBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses the request body as a JSON object. Invalid JSON, an empty body, and JSON that isn't an
 * object (array, string, number, null) all become `{}`: every route treats a missing field as
 * "not provided", and none tells those cases apart.
 */
export async function readJsonBody(request: Request): Promise<JsonBody> {
  const body: unknown = await request.json().catch(() => null);
  return isJsonObject(body) ? body : {};
}

/** The value if it is an array, otherwise `[]`. Elements stay `unknown`. */
export function unknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** The string elements of the value if it is an array (other elements dropped), otherwise `[]`. */
export function stringArray(value: unknown): string[] {
  return unknownArray(value).filter((v): v is string => typeof v === "string");
}

/**
 * Hands a body value to a server action without checking its shape here. Server actions are the
 * validation boundary for these values: any client can call an action with arbitrary arguments,
 * so the actions this is used with re-check the shape at runtime (for example
 * `commitDoublesGroupsAction` rejects malformed matchups and group assignments). The type comes
 * from the parameter the value is passed to.
 */
export function checkedByAction<T>(value: unknown): T {
  return value as T;
}
