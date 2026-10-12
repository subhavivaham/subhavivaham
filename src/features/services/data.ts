import type { ServiceProvider } from "./types";

// Service reads and writes go through the database: lib/data/queries.ts for the
// public listing, lib/data/admin-queries.ts and app/(admin)/admin/actions.ts for
// admin writes. This file only holds the shape the admin form submits.

export type ServiceInput = Omit<ServiceProvider, "id" | "addedAt" | "active" | "isApproved">;
