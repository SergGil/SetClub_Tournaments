import { redirect } from "next/navigation";

import { HomePanelForm } from "@/components/admin/home-panel-form";
import { getAdminScope, getSession } from "@/lib/permissions";
import { getHomePanelSettings } from "@/lib/queries/home-panels";
import { homePanelDomainValues } from "@/lib/validation/home-panels";

export default async function AdminHomePanelsPage() {
  const { isSuperAdmin, domains } = getAdminScope(await getSession());
  if (!isSuperAdmin && domains.length === 0) {
    redirect("/admin");
  }

  const settings = await getHomePanelSettings();
  // Each domain's own admin only edits their own panel - a COFFEE admin
  // never sees the Tennis/Padel forms, even though all three panels live on
  // the shared homepage (see requireDomainAdmin(key) in actions/home-panels.ts).
  const editableKeys = homePanelDomainValues.filter((key) => isSuperAdmin || domains.includes(key));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground/80">
        Текст трьох панелей на головній сторінці сайту (Кава / Теніс / Падел).
      </p>

      <div className="flex flex-col gap-4">
        {editableKeys.map((key) => (
          <HomePanelForm key={key} panelKey={key} {...settings[key]} />
        ))}
      </div>
    </div>
  );
}
