import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getProtectedAdminEmails } from "@/lib/admin-emails";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

const adminEmails = getProtectedAdminEmails();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [Google],
  pages: {
    signIn: "/login",
    // Without this, a failed sign-in shows Auth.js's own bare "Server
    // error" page. Routing it back to /login lets that page show a
    // friendly, branded message instead (see safeCallbackPath's sibling
    // handling of the `error` param there).
    error: "/login",
  },
  logger: {
    error(error) {
      console.error("[auth][error:detailed]", error, "cause:", (error as { cause?: unknown }).cause);
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "MEMBER";
      return session;
    },
  },
  events: {
    // Runs once, right after Auth.js creates a brand-new User row.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();

      if (adminEmails.includes(email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
    // Runs on every sign-in (not just the first), so a Player an admin
    // creates or annotates with an email *after* someone's first login
    // still gets linked automatically on their next sign-in - including a
    // Player an admin explicitly unlinkPlayerAction'd, if its email is still
    // set (unlinkPlayerAction only clears userId - a deliberate choice, so
    // the account can reattach on its own, per unlink-player-button.tsx's
    // own confirmation copy). Since that re-link can happen with no admin in
    // the loop, log it the same way a manual link would be logged - so
    // there's still a paper trail for what would otherwise be a silent change.
    async signIn({ user }) {
      if (!user.id || !user.email) return;
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
          { id: user.id, name: user.name, email: user.email },
          {
            action: "player.link",
            entityType: "Player",
            entityId: player.id,
            summary: `Гравця "${player.name}" автоматично прив'язано при вході (email збігся)`,
          },
        );
      }
    },
  },
});
