"use server";

// thin server-action bridge for the two reads the browser actually needs.
// mysql cannot run in the browser, so client components call these instead of
// importing queries.ts directly — a direct import would pull mysql2 (and node's
// net/tls) into the client bundle and break the build.
import { fetchCommunities, fetchProfiles } from "@/lib/data/queries";

export async function loadPublicProfiles() {
  return fetchProfiles();
}

export async function loadCommunities() {
  return fetchCommunities();
}
