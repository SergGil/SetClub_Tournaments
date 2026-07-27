import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [Google],
  pages: {
    signIn: "/login",
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

      // Auto-link a placeholder Player an admin created earlier by email.
      await prisma.player.updateMany({
        where: { email, userId: null },
        data: { userId: user.id },
      });
    },
  },
});
