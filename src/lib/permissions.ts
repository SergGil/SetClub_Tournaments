import "server-only";

import { auth } from "@/lib/auth";

export async function getSession() {
  return auth();
}

export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

/** Throws if the current user is not an admin. Use at the top of admin-only server actions. */
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

/** Throws if there is no signed-in user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: sign-in required");
  }
  return session;
}
