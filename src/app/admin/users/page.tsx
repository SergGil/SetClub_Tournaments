import { UserRoleSelect } from "@/components/admin/user-role-select";
import { LoadMore } from "@/components/load-more";
import { SearchInput } from "@/components/search-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProtectedAdminEmails } from "@/lib/admin-emails";
import { parseShowParam } from "@/lib/load-more";
import { getSession } from "@/lib/permissions";
import { getUsersPage } from "@/lib/queries/users";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; q?: string }>;
}) {
  const { show: showParam, q: query } = await searchParams;
  const shown = parseShowParam(showParam, PAGE_SIZE);
  const [{ users, total }, session] = await Promise.all([getUsersPage(shown, query), getSession()]);
  const protectedAdminEmails = getProtectedAdminEmails();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/80">
        Користувачів: {total}. Роль присвоюється при першому вході через Google; тут можна її
        змінити вручну.
      </p>

      <SearchInput placeholder="Пошук за іменем чи email" defaultValue={query} />

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Користувач</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === session?.user?.id;
              const isProtected = protectedAdminEmails.includes(user.email.toLowerCase());
              const disabledReason = isSelf
                ? "Не можна змінити власну роль"
                : isProtected
                  ? "Суперадміна не можна понизити"
                  : undefined;
              return (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <Avatar className="size-6">
                      <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                      <AvatarFallback>{(user.name ?? user.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user.name ?? "—"}
                    {isSelf && <span className="text-xs text-muted-foreground">(ви)</span>}
                    {isProtected && <Badge variant="accent">Суперадмін</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <UserRoleSelect
                      userId={user.id}
                      userLabel={user.name ?? user.email}
                      role={user.role}
                      disabled={isSelf || isProtected}
                      disabledReason={disabledReason}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  {query ? "Нічого не знайдено." : "Ще ніхто не входив через Google."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore
        shown={users.length}
        total={total}
        href={`/admin/users?${new URLSearchParams({
          ...(query ? { q: query } : {}),
          show: String(shown + PAGE_SIZE),
        }).toString()}`}
        label={`Показано ${users.length} з ${total}`}
      />
    </div>
  );
}
