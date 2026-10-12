import { fetchMemberInterests } from "@/features/interests/data";
import { InterestsManager } from "@/components/interests/interests-manager";

// both directions are read on the server, from the interests table rather than
// from profiles.interested_profile: which profile "mine" refers to is only
// knowable from the session cookie, so this cannot be a client fetch, and the
// read policies already scope the rows to the two participants.
//
// the page stays a server component on purpose. the client manager owns only the
// tab, the busy row and the local status patch - it never re-reads the lists,
// because a re-render would drop the member's tab.
//
// no MemberPageHeader: /interests is in the mobile bottom tab bar, so it is
// always reachable and does not need the back-to-dashboard link that the
// sidebar-hidden pages require.
export default async function InterestsPage() {
  const { received, sent } = await fetchMemberInterests();

  return <InterestsManager received={received} sent={sent} />;
}
