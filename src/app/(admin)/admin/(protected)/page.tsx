import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import { fetchDashboardData } from "@/lib/data/admin-queries";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard — Subha Vivaham",
};

export default async function AdminDashboardPage() {
  await requireAdmin();
  const data = await fetchDashboardData();

  return <AdminDashboard data={data} />;
}
