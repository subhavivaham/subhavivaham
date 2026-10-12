// the member's own interest lists, read from public.interests.
//
// a row there is the record: from_profile_id, to_profile_id, a status the
// recipient moves, an optional message and the timestamps. the read policies in
// table_policies.sql already scope the table to rows where the member is one of
// the two profiles (or is an admin), so these queries do not filter by owner -
// they only pick which side of the pair the member is on.
//
// profiles.interested_profile is still read, and still written by sendInterest.
// it is the sender's own address book of who they have contacted and the check
// that stops a duplicate send, but it carries no status and no date and lives on
// the sender's row, so it cannot answer "who sent me one". the two are merged
// below rather than the array being dropped, because members who sent an
// interest before the table was wired up only have the array and would otherwise
// watch their sent list empty out.
//
// reads go through the cookie-backed client: which profile is "mine" is only
// knowable from the session. getSupabaseServer reaches next/headers, so this
// module is server-only.
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/data/member-dal";
import { toProfile, type ProfilePhotoRow, type ProfileRow } from "@/lib/data/mappers";
import type { Interest, InterestStatus, Profile } from "@/types";

type Row = Record<string, unknown>;

// the counterpart is the other end of the pair, so one query per side of the
// relationship and both are keyed off the member's own profiles.uuid
interface InterestRow extends Row {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  status: InterestStatus;
  message: string | null;
  viewed: boolean;
  created_at: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function groupPhotos(photos: ProfilePhotoRow[]): Map<string, ProfilePhotoRow[]> {
  const byProfile = new Map<string, ProfilePhotoRow[]>();
  for (const photo of photos) {
    const list = byProfile.get(photo.profile_id) ?? [];
    list.push(photo);
    byProfile.set(photo.profile_id, list);
  }
  return byProfile;
}

function empty(): { received: Interest[]; sent: Interest[] } {
  return { received: [], sent: [] };
}

export type MemberInterests = Awaited<ReturnType<typeof fetchMemberInterests>>;

// newest first. created_at is only guaranteed non-null once
// migrations/0002_interest_tracking.sql has run, so an unstamped row sorts last
// instead of the comparison having to special-case null
const byNewest = (a: Interest, b: Interest) =>
  (b.createdAt || "").localeCompare(a.createdAt || "");

export async function fetchMemberInterests(): Promise<{
  received: Interest[];
  sent: Interest[];
}> {
  const member = await getCurrentMember();
  if (!member?.profileUuid) return empty();

  const supabase = await getSupabaseServer();

  const [receivedRes, sentRes] = await Promise.all([
    supabase
      .from("interests")
      .select("*")
      .eq("to_profile_id", member.profileUuid)
      .order("created_at", { ascending: false }),
    supabase
      .from("interests")
      .select("*")
      .eq("from_profile_id", member.profileUuid)
      .order("created_at", { ascending: false }),
  ]);

  if (receivedRes.error) throw new Error(`interests: ${receivedRes.error.message}`);
  if (sentRes.error) throw new Error(`interests: ${sentRes.error.message}`);

  const receivedRows = (receivedRes.data ?? []) as unknown as InterestRow[];
  const sentRows = (sentRes.data ?? []) as unknown as InterestRow[];

  // the array still holds sends made before the table was wired up
  const { data: ownRow } = await supabase
    .from("profiles")
    .select("interested_profile")
    .eq("user_id", member.userId)
    .maybeSingle();

  const legacyIds = Array.isArray(
    (ownRow as unknown as { interested_profile?: string[] | null } | null)?.interested_profile
  )
    ? ((ownRow as unknown as { interested_profile: string[] }).interested_profile ?? []).filter(Boolean)
    : [];

  // resolve every counterpart in one round trip: the public profile_id of the
  // other end, which is what the array holds and what /profile/[id] links to
  const counterpartUuids = [
    ...new Set([
      ...receivedRows.map((r) => r.from_profile_id),
      ...sentRows.map((r) => r.to_profile_id),
    ]),
  ].filter((uuid) => uuid && uuid !== member.profileUuid);

  const profilesByUuid = new Map<string, ProfileRow>();
  if (counterpartUuids.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", counterpartUuids);
    if (error) throw new Error(`profiles: ${error.message}`);
    for (const row of (data ?? []) as unknown as ProfileRow[]) {
      profilesByUuid.set(row.id, row);
    }
  }

  // one photo read for both lists rather than one per row
  let photosByProfile = new Map<string, ProfilePhotoRow[]>();
  if (profilesByUuid.size > 0) {
    const { data, error } = await supabase
      .from("profile_photos")
      .select("*")
      .in("profile_id", [...profilesByUuid.keys()])
      .order("sort_order");
    if (error) throw new Error(`profile_photos: ${error.message}`);
    photosByProfile = groupPhotos((data ?? []) as unknown as ProfilePhotoRow[]);
  }

  const build = (row: InterestRow, otherUuid: string, direction: Interest["direction"]): Interest | null => {
    const other = profilesByUuid.get(otherUuid);
    // a pair whose other profile was deleted still has its row, because the
    // column is nullable on delete. there is nothing to show, so it is dropped
    if (!other) return null;

    const profile: Profile = toProfile(other, photosByProfile.get(other.id) ?? []);

    return {
      id: str(row.id),
      profile,
      status: (row.status ?? "pending") as InterestStatus,
      direction,
      createdAt: str(row.created_at),
      viewed: Boolean(row.viewed),
      ...(str(row.message) ? { message: str(row.message) } : {}),
    };
  };

  const received = receivedRows
    .map((row) => build(row, row.from_profile_id, "received"))
    .filter((i): i is Interest => i !== null)
    .sort(byNewest);

  const trackedIds = new Set(sentRows.map((row) => row.to_profile_id));
  const sent = sentRows
    .map((row) => build(row, row.to_profile_id, "sent"))
    .filter((i): i is Interest => i !== null)
    .sort(byNewest);

  // an array-only send has no row, so no status and no date. it is appended
  // after the tracked ones with a blank createdAt, which sorts it last.
  if (legacyIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("profile_id", legacyIds);
    if (error) throw new Error(`profiles: ${error.message}`);

    const legacyRows = (data ?? []) as unknown as ProfileRow[];
    const extraPhotos = await readPhotos(supabase, legacyRows.map((row) => row.id));

    for (const row of legacyRows) {
      // already covered by a row in public.interests, which carries the real
      // status and date
      if (trackedIds.has(row.id)) continue;
      sent.push({
        id: "",
        profile: toProfile(row, extraPhotos.get(row.id) ?? []),
        status: "pending",
        direction: "sent",
        createdAt: "",
        viewed: false,
      });
    }
  }

  return { received, sent };
}

// split out so the legacy path can fetch its own gallery without repeating the
// error handling, and so a member with no legacy sends issues no query at all
async function readPhotos(
  supabase: Awaited<ReturnType<typeof getSupabaseServer>>,
  profileUuids: string[],
): Promise<Map<string, ProfilePhotoRow[]>> {
  if (profileUuids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profile_photos")
    .select("*")
    .in("profile_id", profileUuids)
    .order("sort_order");
  if (error) throw new Error(`profile_photos: ${error.message}`);
  return groupPhotos((data ?? []) as unknown as ProfilePhotoRow[]);
}
