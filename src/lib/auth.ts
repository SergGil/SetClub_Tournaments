import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { provisionNewUser, provisionSignIn } from "@/lib/auth-provisioning";
import { prisma } from "@/lib/db";

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
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "MEMBER";
      const domainRows = await prisma.userAdminDomain.findMany({
        where: { userId: user.id },
        select: { domain: true },
      });
      session.user.domains = domainRows.map((row) => row.domain);
      return session;
    },
  },
  events: {
    // Runs once, right after Auth.js creates a brand-new User row. Shared
    // with the mobile Google sign-in exchange (src/app/api/v1/auth/google)
    // via src/lib/auth-provisioning.ts, so both channels agree on who's an
    // admin and whose Player rows get auto-linked.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      await provisionNewUser({ id: user.id, email: user.email });
    },
    async signIn({ user }) {
      if (!user.id || !user.email) return;
      await provisionSignIn({ id: user.id, name: user.name, email: user.email });
    },
  },
});
