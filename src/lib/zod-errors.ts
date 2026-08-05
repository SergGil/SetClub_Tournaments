import type { z } from "zod";

/**
 * Maps each Zod issue to its field, keyed by dot-joined `path` (e.g.
 * "endDate", or "sets.2.sideAGames" for a nested array field) - lets a form
 * show an error next to the specific input instead of only a single generic
 * message at the bottom. Keeps the first issue per field, matching the
 * existing `issues[0]` convention used for the top-level `error` string.
 */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
