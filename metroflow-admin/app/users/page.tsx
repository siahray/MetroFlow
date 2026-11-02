import { AppShell } from "@/components/app-shell";
import { UsersManagement } from "@/components/users-management";

export default function UsersPage() {
  return (
    <AppShell activeItem="users" title="User Management">
      <UsersManagement />
    </AppShell>
  );
}
