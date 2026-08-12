import type { DefaultSession } from "next-auth";

import type { AdminDomain, Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Scoped admin domains (Кава/Теніс/Падел) - empty for MEMBERs with no
       *  domain admin access. Role.ADMIN (superadmin) has full access
       *  everywhere regardless of this list - see src/lib/permissions.ts. */
      domains: AdminDomain[];
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}
