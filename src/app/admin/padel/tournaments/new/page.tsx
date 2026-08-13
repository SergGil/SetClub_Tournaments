import { redirect } from "next/navigation";

import { PadelTournamentForm } from "@/components/admin/padel-tournament-form";
import { isDomainAdmin } from "@/lib/permissions";

export default async function NewPadelTournamentPage() {
  if (!(await isDomainAdmin("PADEL"))) {
    redirect("/admin");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Новий турнір (Падел)</h2>
      <PadelTournamentForm />
    </div>
  );
}
