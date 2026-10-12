import type { Metadata } from "next";
import { requireAdmin } from "@/lib/data/admin-dal";
import {
  fetchAdminCommunities,
  fetchAdminPayments,
  fetchAdminProfiles,
  fetchAdminUsers,
} from "@/lib/data/admin-queries";
import { ProfilesManager } from "@/components/admin/profiles-manager";

export const metadata: Metadata = {
  title: "Profiles — Admin",
};

export default async function AdminProfilesPage() {
  await requireAdmin();
  const [profiles, users, communities, payments] = await Promise.all([
    fetchAdminProfiles(),
    fetchAdminUsers(),
    fetchAdminCommunities(),
    fetchAdminPayments(),
  ]);

  const communityNames = communities
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));

  return (
    <ProfilesManager
      initialProfiles={profiles}
      users={users}
      communityNames={communityNames}
      payments={payments}
    />
  );
}
