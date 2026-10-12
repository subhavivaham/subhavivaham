import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import {
  fetchAdminCommunities,
  fetchAdminProfiles,
} from "@/lib/data/admin-queries";
import { CommunitiesManager } from "@/components/admin/communities-manager";

export const metadata: Metadata = {
  title: "Communities — Admin",
};

export default async function AdminCommunitiesPage() {
  await requireAdmin();
  const [communities, profiles] = await Promise.all([
    fetchAdminCommunities(),
    fetchAdminProfiles(),
  ]);

  // the community table shows a live profile count per community rather than
  // the denormalised visible_members column
  const profileCountByCommunity = profiles.reduce<Record<string, number>>((acc, p) => {
    if (p.community) acc[p.community] = (acc[p.community] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <CommunitiesManager
      initialCommunities={communities}
      profileCountByCommunity={profileCountByCommunity}
    />
  );
}
