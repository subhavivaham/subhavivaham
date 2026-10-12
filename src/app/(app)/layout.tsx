import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/data/mode";
import { getCurrentMember } from "@/lib/data/member-dal";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MembersSignInWall } from "@/components/layout/members-sign-in-wall";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();

  // with a real backend the session cookie is the only thing that opens this
  // area, and it is checked here so the page is never rendered for a signed-out
  // visitor. this mirrors the admin area: a layout is not re-run on every client
  // navigation and can be bypassed, so anything reading private data still goes
  // through the dal.
  if (isSupabaseConfigured) {
    if (!member) redirect("/login");
    return <DashboardShell>{children}</DashboardShell>;
  }

  // mock mode has no sessions, so the client-side wall is the whole gate
  return (
    <MembersSignInWall>
      <DashboardShell>{children}</DashboardShell>
    </MembersSignInWall>
  );
}
