import type { Community } from "./data";

// Reads and writes for communities go through the database
// (lib/data/queries.ts for public reads, app/(admin)/admin/actions.ts for
// writes). This file only holds the shape the admin form submits.

export type CommunityInput = Omit<Community, "id" | "active">;
