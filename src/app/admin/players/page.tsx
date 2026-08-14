import { PlusIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { PlayerDialog } from "@/components/admin/player-dialog";
import { PlayersTable } from "@/components/admin/players-table";
import { LoadMore } from "@/components/load-more";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { parseShowParam } from "@/lib/load-more";
import { isDomainsAdmin } from "@/lib/permissions";
import { countLabel, PLAYER_FORMS } from "@/lib/pluralize";
import { getLinkedUserIds, getPlayersPage } from "@/lib/queries/players";
import { getUsers } from "@/lib/queries/users";

const PAGE_SIZE = 20;

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  if (!(await isDomainsAdmin(["TENNIS", "PADEL"]))) {
    redirect("/admin");
  }

  const { show: showParam, q: query } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const [{ players, total }, users, linkedUserIds] = await Promise.all([
    getPlayersPage(shown, query),
    getUsers(),
    getLinkedUserIds(),
  ]);
  const unlinkedUsers = users.filter((u) => !linkedUserIds.has(u.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/80">
          {countLabel(total, PLAYER_FORMS)}. Гравець без email — це заглушка для історичних
          результатів.
        </p>
        <PlayerDialog
          trigger={
            <Button>
              <PlusIcon /> Додати гравця
            </Button>
          }
        />
      </div>

      <SearchInput placeholder="Пошук за іменем чи email" defaultValue={query} />

      <PlayersTable players={players} unlinkedUsers={unlinkedUsers} hasQuery={Boolean(query)} />

      <LoadMore
        shown={players.length}
        total={total}
        href={`/admin/players?${new URLSearchParams({
          ...(query ? { q: query } : {}),
          show: String(shown + PAGE_SIZE),
        }).toString()}`}
        label={`Показано ${players.length} з ${countLabel(total, PLAYER_FORMS)}`}
      />
    </div>
  );
}
