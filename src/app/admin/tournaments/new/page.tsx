import { redirect } from "next/navigation";

import { TournamentForm } from "@/components/admin/tournament-form";
import { isDomainAdmin } from "@/lib/permissions";

export default async function NewTournamentPage() {
  if (!(await isDomainAdmin("TENNIS"))) {
    redirect("/admin");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Новий турнір</h2>
      <TournamentForm />
    </div>
  );
}
