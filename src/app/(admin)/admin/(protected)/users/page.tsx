import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import { fetchAdminUsers } from "@/lib/data/admin-queries";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata: Metadata = {
  title: "Users — Admin",
};

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const users = await fetchAdminUsers();

  return <UsersManager initialUsers={users} currentUserEmail={admin.email} />;
}
