import { NextResponse } from "next/server";
import { q1 } from "@/lib/db";

export const dynamic = "force-dynamic";

// reports whether the app can reach MySQL, without leaking credentials or rows.
// hits only the tables the public site depends on.
const TABLES = [
  "users",
  "profiles",
  "communities",
  "membership_plans",
  "service_providers",
  "temples",
  "success_stories",
  "site_config",
] as const;

export async function GET() {
  const target = `${process.env.DB_USER ?? "root"}@${process.env.DB_HOST ?? "localhost"}:${
    process.env.DB_PORT ?? 3306
  }/${process.env.DB_NAME ?? "subhavivaham"}`;

  try {
    const version = await q1<{ v: string }>("select version() as v");

    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      try {
        const row = await q1<{ c: number }>(`select count(*) as c from \`${table}\``);
        counts[table] = Number(row?.c ?? 0);
      } catch {
        counts[table] = -1;
      }
    }

    return NextResponse.json({
      ok: true,
      target,
      server: version?.v ?? "unknown",
      counts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        target,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
