"use client";

import Link from "next/link";
import {
  Users,
  Contact,
  UsersRound,
  Crown,
  ArrowRight,
  BadgeCheck,
  Store,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { PageHeader } from "@/components/admin/shared";
import { SERVICE_TYPE_LABELS } from "@/features/services/types";
import type { DashboardData } from "@/lib/data/admin-queries";
import { formatRelativeTime } from "@/lib/utils";

// profile_created_on is nullable, and an empty string has no valid Date. the
// old inline new Date(x).toLocaleDateString() printed "Invalid Date" in that
// cell, so a missing date is shown as a dash instead.
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (!iso || Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  // the queue an admin actually has to clear: vendor listings still waiting on
  // review, newest first, so the eight rows shown are the eight most recent
  // decisions outstanding.
  const attention = [
    ...data.pendingServices.map((s) => ({
      key: `svc-${s.id}`,
      href: "/admin/services",
      title: `${s.name} awaiting approval`,
      detail: [SERVICE_TYPE_LABELS[s.type], s.city].filter(Boolean).join(" · "),
      time: s.addedAt,
      pill: "pending",
      tone: "warn" as const,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);

  // already filtered and ordered by the query: profile_created_on desc, so the
  // six rows are the newest unverified profiles
  const pendingVerification = data.unverifiedProfiles.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Live platform overview across profiles, communities and moderation."
      />

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Registered users"
          value={data.users.length}
          trend={{ label: `${data.users.filter((u) => u.status === "active").length} active` }}
        />
        <StatCard
          icon={<Contact className="h-5 w-5" />}
          label="Member profiles"
          value={data.profiles.length}
          trend={{ label: `${data.live} live · ${data.verified} verified`, up: true }}
          tone="gold"
        />
        <StatCard
          icon={<UsersRound className="h-5 w-5" />}
          label="Communities"
          value={data.communities.length}
          trend={{
            label: `${data.communities.filter((c) => c.active).length} active`,
          }}
          tone="success"
        />
        <StatCard
          icon={<Crown className="h-5 w-5" />}
          label="Active subscriptions"
          value={data.activeSubs.length}
          trend={{
            label: `${data.paidSubs.length} paid · ₹${data.revenue.toLocaleString("en-IN")}`,
            up: true,
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          {
            label: "Unverified profiles",
            value: data.unverifiedProfiles.length,
            href: "/admin/profiles",
            icon: BadgeCheck,
            tone: data.unverifiedProfiles.length > 0 ? "text-gold-700" : "text-charcoal-500",
          },
          {
            // is_approved and active, the same pair the public services page
            // requires, so this can never be higher than the listings on the site
            label: "Listed vendors",
            value: data.listedServices.length,
            href: "/admin/services",
            icon: Store,
            tone: "text-charcoal-800",
          },
          {
            label: "Hidden communities",
            value: data.communities.filter((c) => !c.active).length,
            href: "/admin/communities",
            icon: UsersRound,
            tone:
              data.communities.filter((c) => !c.active).length > 0
                ? "text-charcoal-800"
                : "text-charcoal-500",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex items-center gap-3 rounded-2xl border border-charcoal-100 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal-50">
              <card.icon className="h-4 w-4 text-charcoal-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-semibold text-charcoal-900">{card.value}</span>
              <span className={`block text-xs font-medium ${card.tone}`}>{card.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Needs attention"
          action={
            <Pill tone={attention.length > 0 ? "bad" : "good"}>
              {attention.length > 0
                ? `${data.pendingServices.length} open`
                : "All clear"}
            </Pill>
          }
        >
          {attention.length === 0 ? (
            <p className="py-8 text-center text-sm text-charcoal-400">
              No vendor approvals are waiting on you.
            </p>
          ) : (
            <ul className="divide-y divide-charcoal-50">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-charcoal-50/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-charcoal-700">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-charcoal-400">
                        {item.detail} · {formatRelativeTime(item.time)}
                      </span>
                    </span>
                    {/* shrink-0: a pill is allowed to shrink inside a flex row, and
                        a squeezed one wraps its label to two lines and pushes the
                        row taller than its neighbours */}
                    <span className="shrink-0">
                      <Pill tone={item.tone}>{item.pill}</Pill>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Awaiting verification"
          action={
            <Link
              href="/admin/profiles"
              className="inline-flex items-center gap-1 text-xs font-semibold text-wine-700 hover:underline"
            >
              Review all <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {pendingVerification.length === 0 ? (
            <p className="py-8 text-center text-sm text-charcoal-400">
              Every profile has been verified.
            </p>
          ) : (
            <>
              {/* five columns do not fit a phone, and the table's min-width means
                  a narrow screen gets a sideways-scrolling card inside a page
                  that also scrolls sideways. below sm the same rows are stacked,
                  the shape the Needs attention list beside it already uses, so
                  the two panels read as one queue rather than two layouts. */}
              {/* pb-4 on the list itself, not on the rows: on a phone this list is
                  the last thing in the card, and the card's own py-4 alone leaves
                  the final row sitting close against the rounded bottom edge. */}
              <ul className="divide-y divide-charcoal-50 pb-4 sm:hidden">
                {pendingVerification.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-charcoal-700">
                        {p.fullName}
                      </span>
                      <span className="block truncate text-xs text-charcoal-400">
                        {[p.community, p.city].filter(Boolean).join(" · ")}
                        {p.profileCreatedOn && ` · ${formatDate(p.profileCreatedOn)}`}
                      </span>
                    </span>
                    <span className="shrink-0">
                      <Pill tone="warn">
                        <BadgeCheck className="mr-1 h-3 w-3" /> Review
                      </Pill>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block">
                <Table head={["Profile", "Community", "City", "Created", ""]}>
                  {pendingVerification.map((p) => (
                    <Row key={p.id}>
                      <Cell className="font-semibold text-charcoal-700">{p.fullName}</Cell>
                      <Cell className="text-charcoal-500">{p.community}</Cell>
                      <Cell className="text-charcoal-500">{p.city}</Cell>
                      <Cell className="whitespace-nowrap text-charcoal-500">
                        {formatDate(p.profileCreatedOn)}
                      </Cell>
                      <Cell>
                        <Pill tone="warn">
                          <BadgeCheck className="mr-1 h-3 w-3" /> Review
                        </Pill>
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
