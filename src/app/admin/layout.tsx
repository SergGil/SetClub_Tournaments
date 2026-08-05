import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { getSession } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  // Signed in but not an admin: sending them back to /login would just bounce
  // straight back here (the login page redirects anyone already signed in to
  // callbackUrl), producing an infinite redirect loop. Send them home instead.
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Адмін-панель</h1>
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
