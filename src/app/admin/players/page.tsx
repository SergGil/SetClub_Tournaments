import { PencilIcon, PlusIcon } from "lucide-react";

import { DeletePlayerButton } from "@/components/admin/delete-player-button";
import { LinkPlayerControl } from "@/components/admin/link-player-control";
import { PlayerDialog } from "@/components/admin/player-dialog";
import { UnlinkPlayerButton } from "@/components/admin/unlink-player-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countLabel, PLAYER_FORMS } from "@/lib/pluralize";
import { getPlayers } from "@/lib/queries/players";
import { getUsers } from "@/lib/queries/users";

export default async function AdminPlayersPage() {
  const [players, users] = await Promise.all([getPlayers(), getUsers()]);
  const linkedUserIds = new Set(players.map((p) => p.userId).filter(Boolean));
  const unlinkedUsers = users.filter((u) => !linkedUserIds.has(u.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {countLabel(players.length, PLAYER_FORMS)}. Гравець без email — це заглушка для
          історичних результатів.
        </p>
        <PlayerDialog
          trigger={
            <Button>
              <PlusIcon /> Новий гравець
            </Button>
          }
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ім&apos;я</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Акаунт</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">{player.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {player.email ?? player.user?.email ?? "—"}
              </TableCell>
              <TableCell>
                {player.userId ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Прив&apos;язано</Badge>
                    <UnlinkPlayerButton playerId={player.id} name={player.name} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Заглушка</Badge>
                    <LinkPlayerControl playerId={player.id} candidates={unlinkedUsers} />
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <PlayerDialog
                    player={player}
                    trigger={
                      <Button variant="ghost" size="icon-sm">
                        <PencilIcon />
                        <span className="sr-only">Редагувати</span>
                      </Button>
                    }
                  />
                  <DeletePlayerButton id={player.id} name={player.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {players.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                Ще немає жодного гравця.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
