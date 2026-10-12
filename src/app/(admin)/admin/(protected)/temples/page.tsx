import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import { fetchAdminTemples } from "@/lib/data/admin-queries";
import { TemplesManager } from "@/components/admin/temples-manager";

export const metadata: Metadata = {
  title: "Temples — Admin",
};

export default async function AdminTemplesPage() {
  await requireAdmin();
  const temples = await fetchAdminTemples();

  return <TemplesManager initialTemples={temples} />;
}
