import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/data/member-dal";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();

  // the session cookie is the only thing that opens this area, and it is checked
  // here so the page is never rendered for a signed-out visitor. this mirrors the
  // admin area: a layout is not re-run on every client navigation and can be
  // bypassed, so anything reading private data still goes through the dal.
  if (!member) redirect("/login");
  return <DashboardShell>{children}</DashboardShell>;
}
