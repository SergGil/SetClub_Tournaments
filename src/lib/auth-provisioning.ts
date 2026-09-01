import "server-only";

import { logAudit } from "@/lib/audit";
import { getProtectedAdminEmails } from "@/lib/admin-emails";
import { prisma } from "@/lib/db";

const adminEmails = getProtectedAdminEmails();

/**
 * Runs once, right after a brand-new User row exists - whether created by
 * Auth.js's web OAuth flow (`events.createUser` in src/lib/auth.ts) or by
 * the mobile Google sign-in exchange (src/app/api/v1/auth/google/route.ts).
 * Promotes allowlisted admin emails to SUPERADMIN so the two channels can't
 * drift out of sync on who counts as an admin.
 */
export async function provisionNewUser(user: { id: string; email: string }) {
  const email = user.email.toLowerCase();
  if (adminEmails.includes(email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "SUPERADMIN" } });
  }
}

/**
 * Runs on every sign-in (not just the first), web or mobile - links any
 * Player rows an admin created or annotated with this email *after* the
 * user's first login, the same way a manual link would. Since this can
 * happen with no admin in the loop, it's logged the same way a manual link
 * would be.
 */
export async function provisionSignIn(user: { id: string; name?: string | null; email: string }) {
  const email = user.email.toLowerCase();
  const playersToLink = await prisma.player.findMany({
    where: { email, userId: null },
    select: { id: true, name: true },
  });
  if (playersToLink.length === 0) return;

  await prisma.player.updateMany({
    where: { email, userId: null },
    data: { userId: user.id },
  });

  for (const player of playersToLink) {
    await logAudit(
      { id: user.id, name: user.name, email },
      {
        action: "player.link",
        entityType: "Player",
        entityId: player.id,
        summary: `Гравця "${player.name}" автоматично прив'язано при вході (email збігся)`,
      },
    );
  }
}
