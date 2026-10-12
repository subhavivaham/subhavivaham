import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import { fetchAdminServices } from "@/lib/data/admin-queries";
import { ServicesManager } from "@/components/admin/services-manager";

export const metadata: Metadata = {
  title: "Vendor Services — Admin",
};

export default async function AdminServicesPage() {
  await requireAdmin();
  const services = await fetchAdminServices();

  return <ServicesManager initialServices={services} />;
}
