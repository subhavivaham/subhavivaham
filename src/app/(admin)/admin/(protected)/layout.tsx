import { requireAdmin } from "@/lib/data/admin-dal";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // the single entry gate for every protected admin screen. each page still
  // reads through the DAL and each action re-checks with assertAdmin(), because
  // a layout is not re-run on every navigation and can be bypassed entirely
  const admin = await requireAdmin();

  return (
    <AdminShell adminName={admin.email} adminEmail={admin.email}>
      {children}
    </AdminShell>
  );
}
