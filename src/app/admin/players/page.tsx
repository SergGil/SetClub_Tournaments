import { PlusIcon } from "lucide-react";

import { PlayerDialog } from "@/components/admin/player-dialog";
import { PlayersTable } from "@/components/admin/players-table";
import { Button } from "@/components/ui/button";
import { countLabel, PLAYER_FORMS } from "@/lib/pluralize";
import { getPlayers } from "@/lib/queries/players";
import { getUsers } from "@/lib/queries/users";

export default async function AdminPlayersPage() {
  const [players, users] = await Promise.all([getPlayers(), getUsers()]);
  const linkedUserIds = new Set(players.map((p) => p.userId).filter(Boolean));
  const unlinkedUsers = users.filter((u) => !linkedUserIds.has(u.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {countLabel(players.length, PLAYER_FORMS)}. Гравець без email — це заглушка для
          історичних результатів.
        </p>
        <PlayerDialog
          trigger={
            <Button>
              <PlusIcon /> Додати гравця
            </Button>
          }
        />
      </div>

      <PlayersTable players={players} unlinkedUsers={unlinkedUsers} />
    </div>
  );
}
