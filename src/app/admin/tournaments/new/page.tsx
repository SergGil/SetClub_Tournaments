import { TournamentForm } from "@/components/admin/tournament-form";

export default function NewTournamentPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Новий турнір</h2>
      <TournamentForm />
    </div>
  );
}
