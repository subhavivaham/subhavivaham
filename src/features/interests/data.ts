// the member's own interest lists, read from public.interests.
//
// a row there is the record: from_profile_id, to_profile_id, a status the
// recipient moves, an optional message and the timestamps. every query is
// explicitly scoped to the member's own profiles.uuid — mysql has no row level
// security, so that filter is the whole boundary.
//
// profiles.interested_profile is still read, and still written by sendInterest.
// it is the sender's own address book of who they have contacted and the check
// that stops a duplicate send, but it carries no status and no date and lives on
// the sender's row, so it cannot answer "who sent me one". the two are merged
// below rather than the array being dropped, because members who sent an
// interest before the table was wired up only have the array and would otherwise
// watch their sent list empty out.
import { getCurrentMember } from "@/lib/data/member-dal";
import { q, q1 } from "@/lib/db";
import { jsonList, toProfile, type ProfilePhotoRow, type ProfileRow } from "@/lib/data/mappers";
import type { Interest, InterestStatus, Profile } from "@/types";

type Row = Record<string, unknown>;

interface InterestRow extends Row {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  status: InterestStatus;
  message: string | null;
  viewed: number;
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

// newest first. an unstamped row sorts last instead of the comparison having to
// special-case null
const byNewest = (a: Interest, b: Interest) =>
  (b.createdAt || "").localeCompare(a.createdAt || "");

export async function fetchMemberInterests(): Promise<{
  received: Interest[];
  sent: Interest[];
}> {
  const member = await getCurrentMember();
  if (!member?.profileUuid) return empty();

  const [receivedRows, sentRows, ownRow] = await Promise.all([
    q<InterestRow>(
      "select * from interests where to_profile_id = ? order by created_at desc",
      [member.profileUuid]
    ),
    q<InterestRow>(
      "select * from interests where from_profile_id = ? order by created_at desc",
      [member.profileUuid]
    ),
    q1<{ interested_profile: string[] | null }>(
      "select interested_profile from profiles where user_id = ?",
      [member.userId]
    ),
  ]);

  // the array still holds sends made before the table was wired up. it is stored
  // as json, so it may arrive as a string, a parsed array, or null.
  const legacyIds = jsonList(ownRow?.interested_profile).filter(Boolean);

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
    const placeholders = counterpartUuids.map(() => "?").join(",");
    const rows = await q<ProfileRow>(
      `select * from profiles where id in (${placeholders})`,
      counterpartUuids
    );
    for (const row of rows) profilesByUuid.set(row.id, row);
  }

  // one photo read for both lists rather than one per row
  let photosByProfile = new Map<string, ProfilePhotoRow[]>();
  if (profilesByUuid.size > 0) {
    const placeholders = [...profilesByUuid.keys()].map(() => "?").join(",");
    photosByProfile = groupPhotos(
      await q<ProfilePhotoRow>(
        `select * from profile_photos where profile_id in (${placeholders}) order by sort_order`,
        [...profilesByUuid.keys()]
      )
    );
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
    const placeholders = legacyIds.map(() => "?").join(",");
    const legacyRows = await q<ProfileRow>(
      `select * from profiles where profile_id in (${placeholders})`,
      legacyIds
    );

    const photoUuids = legacyRows.map((row) => row.id);
    let extraPhotos = new Map<string, ProfilePhotoRow[]>();
    if (photoUuids.length > 0) {
      const photoPlaceholders = photoUuids.map(() => "?").join(",");
      extraPhotos = groupPhotos(
        await q<ProfilePhotoRow>(
          `select * from profile_photos where profile_id in (${photoPlaceholders}) order by sort_order`,
          photoUuids
        )
      );
    }

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
