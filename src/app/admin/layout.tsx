import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getSession } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  const isSuperAdmin = session.user.role === "SUPERADMIN";
  // Domains only count for an ADMIN-role user (docs/ADMIN_DOMAINS.md) - a
  // demoted-back-to-MEMBER account might still have leftover rows, which
  // must NOT grant access.
  const domains = session.user.role === "ADMIN" ? session.user.domains : [];
  // Signed in but no admin access at all (not superadmin, no domain roles):
  // sending them back to /login would just bounce straight back here (the
  // login page redirects anyone already signed in to callbackUrl), producing
  // an infinite redirect loop. Send them home instead. Finer-grained access
  // (which sections a domain admin actually sees/can use) is handled by
  // AdminNav + each page/action's own requireDomainAdmin() - see
  // docs/ADMIN_DOMAINS.md.
  if (!isSuperAdmin && domains.length === 0) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Адмін-панель</h1>
        <AdminNav isSuperAdmin={isSuperAdmin} domains={domains} />
      </div>
      {children}
    </div>
  );
}
