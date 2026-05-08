import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import { listPlatformAdminUsers } from "@/services/platform-admin";

export default async function PlatformAdminUsersListPage() {
  const users = await listPlatformAdminUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform users</CardTitle>
        <CardDescription>
          Internal accounts with access to the reserved admin host.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.authUser.name}</TableCell>
                <TableCell>{user.authUser.email}</TableCell>
                <TableCell className="capitalize">{user.role.replaceAll("_", " ")}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "secondary" : "outline"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDisplayDate(user.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
