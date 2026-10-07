import { PencilIcon } from "lucide-react";

import { DeletePlayerButton } from "@/components/admin/delete-player-button";
import { LinkPlayerControl } from "@/components/admin/link-player-control";
import { PlayerDialog } from "@/components/admin/player-dialog";
import { UnlinkPlayerButton } from "@/components/admin/unlink-player-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlayerWithUser } from "@/lib/queries/players";
import type { UserRow } from "@/lib/queries/users";
import { GENDER_LABEL, PLAYER_SPORT_LABEL } from "@/lib/validation/player";

/** "accent" (violet) for female, "info" (blue) for male - an arbitrary but consistent pair, distinct from the Прив'язано/Заглушка badges' own colors so the two don't blend together in the same row. */
const GENDER_VARIANT = { FEMALE: "accent", MALE: "info" } as const;

/** teal for tennis, amber for padel, default (green) for both - distinct from the gender pair above and the Прив'язано/Заглушка badges. */
const SPORT_VARIANT = { TENNIS: "teal", PADEL: "warning", BOTH: "default" } as const;

export function PlayersTable({
  players,
  unlinkedUsers,
  hasQuery,
}: {
  players: PlayerWithUser[];
  unlinkedUsers: UserRow[];
  /** Whether the empty state below should say "nothing found" vs. "no players yet". */
  hasQuery: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border bg-card">
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
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {player.name}
                    {player.nickname && (
                      <span className="font-normal text-muted-foreground">· {player.nickname}</span>
                    )}
                    {player.gender && (
                      <Badge variant={GENDER_VARIANT[player.gender]}>{GENDER_LABEL[player.gender]}</Badge>
                    )}
                    <Badge variant={SPORT_VARIANT[player.sports]}>{PLAYER_SPORT_LABEL[player.sports]}</Badge>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {player.email ?? player.user?.email ?? "—"}
                </TableCell>
                <TableCell>
                  {player.userId ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Прив&apos;язано</Badge>
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
                    <DeletePlayerButton
                      id={player.id}
                      name={player.name}
                      hasHistory={
                        player._count.matchAppearances > 0 ||
                        player._count.tournamentEntries > 0 ||
                        player._count.padelMatchAppearances > 0 ||
                        player._count.padelTournamentEntries > 0
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {players.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  {hasQuery ? "Нічого не знайдено." : "Ще немає жодного гравця."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
