import { q, run } from "@/lib/db";

// communities.visible_members is a denormalised count of the profile rows that
// name that community, so every path that adds, removes or moves a profile has
// to move it as well or the stored number drifts away from the profiles table.
//
// the count is recomputed rather than incremented: two registrations landing at
// once cannot lose an update that way. a failure is logged rather than thrown —
// by the time this runs the profile row is already committed.
export async function syncCommunityVisibleMembers(
  names: (string | null | undefined)[]
): Promise<void> {
  const wanted = [
    ...new Set(names.map((name) => name?.trim()).filter((name): name is string => Boolean(name))),
  ];
  if (wanted.length === 0) return;

  try {
    const placeholders = wanted.map(() => "?").join(", ");
    const communities = await q<{ id: string; name: string }>(
      `select id, name from communities where name in (${placeholders})`,
      wanted
    );

    for (const community of communities) {
      const counted = await q<{ n: number }>(
        "select count(*) as n from profiles where community = ?",
        [community.name]
      );
      await run("update communities set visible_members = ? where id = ?", [
        counted[0]?.n ?? 0,
        community.id,
      ]);
    }
  } catch (error) {
    console.warn(
      `[community-counts] could not refresh visible_members for ${wanted.join(", ")}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
