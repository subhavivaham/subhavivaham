import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import {
  fetchAdminPayments,
  fetchAdminPlans,
  fetchAdminSubscriptions,
  fetchAdminUsers,
} from "@/lib/data/admin-queries";
import { MembershipsManager } from "@/components/admin/memberships-manager";

export const metadata: Metadata = {
  title: "Memberships — Admin",
};

export default async function AdminMembershipsPage() {
  await requireAdmin();
  const [plans, subs, users, payments] = await Promise.all([
    fetchAdminPlans(),
    fetchAdminSubscriptions(),
    fetchAdminUsers(),
    fetchAdminPayments(),
  ]);

  return (
    <MembershipsManager
      initialPlans={plans}
      initialSubscriptions={subs}
      users={users}
      initialPayments={payments}
    />
  );
}
