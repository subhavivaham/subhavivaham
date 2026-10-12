import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import { fetchSiteConfig } from "@/lib/data/queries";
import { ConfigForm } from "@/components/admin/config-form";

export const metadata: Metadata = {
  title: "Configuration — Admin",
};

export default async function AdminConfigPage() {
  await requireAdmin();
  const config = await fetchSiteConfig();

  return <ConfigForm initial={config} />;
}
