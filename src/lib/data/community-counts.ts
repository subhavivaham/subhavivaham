import type { SupabaseClient } from "@supabase/supabase-js";

// communities.visible_members is a denormalised count of the profile rows that
// name that community, so every path that adds, removes or moves a profile has to
// move it as well or the stored number drifts away from the profiles table.
//
// the count is recomputed rather than incremented: two registrations landing at
// once cannot lose an update that way, and a community nothing wrote to self-heals
// the next time one of its profiles is touched.
//
// this covers the admin actions, which run as an admin session and so pass
// communities_admin_write. self-service registration cannot use it: that session
// is not an admin, and per table_policies.sql the update would return no error
// while changing nothing. sync_community_member_counts.sql installs the trigger
// that covers that path and every other writer.
//
// a failure is logged rather than thrown. by the time this runs the profile row
// is already committed, so failing the admin action over a counter would trade a
// stale number for a confusing "could not save" on a profile that was saved.
export async function syncCommunityVisibleMembers(
  supabase: SupabaseClient,
  names: (string | null | undefined)[]
): Promise<void> {
  const wanted = [
    ...new Set(names.map((name) => name?.trim()).filter((name): name is string => Boolean(name))),
  ];
  if (wanted.length === 0) return;

  try {
    // only names that match a community row can be written, so the register
    // form's free-text "other" community resolves to nothing here
    const { data: communities, error: lookupError } = await supabase
      .from("communities")
      .select("id, name")
      .in("name", wanted);
    if (lookupError) throw new Error(lookupError.message);

    for (const community of communities ?? []) {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("community", community.name);
      if (countError) throw new Error(countError.message);

      // select after the update so a write that matched no row is visible: RLS
      // filtering an update reports success with nothing changed
      const { data: updated, error: updateError } = await supabase
        .from("communities")
        .update({ visible_members: count ?? 0 })
        .eq("id", community.id)
        .select("id");
      if (updateError) throw new Error(updateError.message);
      if (!updated || updated.length === 0) {
        console.warn(
          `[community-counts] ${community.name} matched no writable row - is this session an admin?`
        );
      }
    }
  } catch (error) {
    console.warn(
      `[community-counts] could not refresh visible_members for ${wanted.join(", ")}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
