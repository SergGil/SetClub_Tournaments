import "server-only";

/**
 * Emails from the ADMIN_EMAILS env var: auto-promoted to SUPERADMIN on first
 * sign-in (see auth.ts's createUser event) and protected from demotion by
 * other admins (see updateUserRoleAction) - the permanent superadmin list.
 */
export function getProtectedAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isProtectedAdminEmail(email: string): boolean {
  return getProtectedAdminEmails().includes(email.toLowerCase());
}
