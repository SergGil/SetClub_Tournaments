import { UserRoleSelect } from "@/components/admin/user-role-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/permissions";
import { getUsers } from "@/lib/queries/users";

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([getUsers(), getSession()]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Користувачів: {users.length}. Роль присвоюється при першому вході через Google; тут можна
        її змінити вручну.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Користувач</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Роль</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="flex items-center gap-2 font-medium">
                <Avatar className="size-6">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
                  <AvatarFallback>{(user.name ?? user.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                {user.name ?? "—"}
                {user.id === session?.user?.id && (
                  <span className="text-xs text-muted-foreground">(ви)</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <UserRoleSelect
                  userId={user.id}
                  role={user.role}
                  disabled={user.id === session?.user?.id}
                />
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                Ще ніхто не входив через Google.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
