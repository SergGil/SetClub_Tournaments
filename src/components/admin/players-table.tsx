"use client";

import { PencilIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { DeletePlayerButton } from "@/components/admin/delete-player-button";
import { LinkPlayerControl } from "@/components/admin/link-player-control";
import { PlayerDialog } from "@/components/admin/player-dialog";
import { UnlinkPlayerButton } from "@/components/admin/unlink-player-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function PlayersTable({
  players,
  unlinkedUsers,
}: {
  players: PlayerWithUser[];
  unlinkedUsers: UserRow[];
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? players.filter((player) =>
        [player.name, player.email, player.user?.email]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalized)),
      )
    : players;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Пошук за іменем чи email"
          className="pl-8"
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
          {filtered.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="font-medium">{player.name}</TableCell>
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
                  <DeletePlayerButton id={player.id} name={player.name} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {players.length === 0 ? "Ще немає жодного гравця." : "Нічого не знайдено."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
