"use client";

import { useMemo, useState, useTransition } from "react";
import { ShieldCheck, Trash2, Crown, Mail, SlidersHorizontal } from "lucide-react";
import type { AdminUser, UserStatus } from "@/types";
import {
  deleteUserAction,
  type ActionResult,
} from "@/app/(admin)/admin/actions";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import {
  FilterTabs,
  PageHeader,
  Pagination,
  SearchInput,
  Toolbar,
} from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { cn } from "@/lib/utils";

type Filter = "all" | "admin" | "member" | "active";

const STATUS_TONE: Record<UserStatus, "good" | "warn" | "bad"> = {
  active: "good",
  suspended: "warn",
  blocked: "bad",
};

const MEMBERSHIP_TONE = {
  free: "neutral",
  silver: "warn",
  premium: "good",
} as const;

const PAGE_SIZE = 20;

// the pills and the mobile sheet list the same four options, so both read from
// one builder and cannot drift apart. suspended and blocked users are no longer
// reachable as a filter, only through the status pill on the row itself
const FILTER_OPTIONS = (counts: {
  all: number;
  admin: number;
  member: number;
  active: number;
}): { key: Filter; label: string; count: number }[] => [
  { key: "all", label: "All", count: counts.all },
  { key: "member", label: "Members", count: counts.member },
  { key: "admin", label: "Admins", count: counts.admin },
  { key: "active", label: "Active", count: counts.active },
];

export function UsersManager({
  initialUsers,
  currentUserEmail,
}: {
  initialUsers: AdminUser[];
  currentUserEmail: string;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<AdminUser[]>(initialUsers);
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  // no pending flag here: there is no form to double-submit, so the transition
  // is only used to keep the delete non-blocking
  const [, startTransition] = useTransition();

  const apply = (result: ActionResult<AdminUser[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setRows(result.data);
    toast(message, "info");
    return true;
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      admin: rows.filter((u) => u.role === "admin").length,
      member: rows.filter((u) => u.role === "member").length,
      active: rows.filter((u) => u.status === "active").length,
    }),
    [rows]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (filter === "admin" || filter === "member") {
        if (u.role !== filter) return false;
      } else if (filter !== "all" && u.status !== filter) {
        return false;
      }
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [rows, filter, query]);

  // a narrowed list can be shorter than the page the admin was on — the last
  // page of 45 rows is page 3, and a filter that leaves 4 rows has no page 3 —
  // so the page number is pulled back into range on every render rather than in
  // an effect, which would leave one paint showing an empty table first
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [visible, currentPage]
  );

  // any change to the filter, the search text or the row count sends the admin
  // back to the first page, otherwise a search on page 3 can land on an empty one
  const changeFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  const search = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      apply(await deleteUserAction(target.id), `${target.name} removed.`);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Registered members, their membership tier and moderation status."
      />

      {/* four pills wrap over two lines on a phone and push the list off the
          screen, so below md they collapse into one Filter button that opens the
          same options in a sheet — the treatment the vendor services page uses */}
      <Toolbar>
        <div className="hidden md:block">
          <FilterTabs value={filter} onChange={changeFilter} options={FILTER_OPTIONS(counts)} />
        </div>

        <div className="flex w-full items-center justify-between gap-3 md:hidden">
          <p className="min-w-0 text-sm text-charcoal-600">
            <span className="font-semibold text-charcoal-900">
              {FILTER_OPTIONS(counts).find((o) => o.key === filter)?.label}
            </span>
            <span className="text-charcoal-400"> · {visible.length} shown</span>
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filter users"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-charcoal-200 bg-white px-3.5 text-sm font-semibold text-charcoal-700 shadow-sm transition-colors hover:border-wine-300 hover:bg-wine-50 hover:text-wine-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {filter !== "all" && (
              <span className="h-1.5 w-1.5 rounded-full bg-wine-700" aria-hidden />
            )}
          </button>
        </div>

        <SearchInput
          value={query}
          onChange={search}
          placeholder="Search name or email…"
          className="w-full sm:w-64"
        />
      </Toolbar>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter users"
        size="sm"
        centerOnMobile
      >
        <ul className="space-y-2">
          {FILTER_OPTIONS(counts).map((option) => {
            const isActive = option.key === filter;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  onClick={() => {
                    changeFilter(option.key);
                    setSheetOpen(false);
                  }}
                  aria-pressed={isActive}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-colors",
                    isActive
                      ? "border-wine-700 bg-wine-700 text-white"
                      : "border-charcoal-200 bg-white text-charcoal-700 hover:border-wine-300 hover:bg-wine-50 hover:text-wine-700"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold",
                      isActive ? "text-white/70" : "text-charcoal-400"
                    )}
                  >
                    {option.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Card
        action={
          <Pill tone="neutral">
            {visible.length} {visible.length === 1 ? "user" : "users"}
          </Pill>
        }
      >
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-charcoal-400 sm:hidden">
            No users match this view.
          </p>
        ) : (
          <>
            {/* six columns are far wider than a phone, and the table's min-width means
                a narrow screen would get a sideways-scrolling card inside a page
                that also scrolls sideways. below md the same rows stack instead,
                so every column survives without a horizontal scrollbar. */}
            <ul className="divide-y divide-charcoal-50 pb-4 md:hidden">
              {paged.map((u) => {
                const isSelf = u.email === currentUserEmail;
                return (
                  <li
                    key={u.id}
                    className={cn(
                      "flex items-start gap-3 py-3",
                      u.status !== "active" && "opacity-70"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine-50 text-sm font-bold uppercase text-wine-700">
                      {u.name.trim().charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-charcoal-700">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-xs font-normal text-charcoal-400">
                            you
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-charcoal-400">
                        {/* shrink-0: a flex item can be squeezed narrower than
                            its icon, which would squash the envelope */}
                        <Mail className="h-3 w-3 shrink-0" /> {u.email}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {u.role === "admin" ? (
                          <Pill tone="good">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                          </Pill>
                        ) : (
                          <Pill tone="neutral">Member</Pill>
                        )}
                        <Pill tone={MEMBERSHIP_TONE[u.membership]}>
                          {u.membership === "premium" && (
                            <Crown className="mr-1 h-3 w-3" />
                          )}
                          {u.membership}
                        </Pill>
                        <Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill>
                        <span className="text-xs text-charcoal-400">
                          Joined {new Date(u.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* shrink-0 and items-start: a button is a flex item that may
                        shrink, and centred alignment would drop the bin below the
                        name once the pill row wraps. this keeps it pinned to the
                        top-right corner of the row, level with the avatar. */}
                    <span className="shrink-0">
                      <IconAction
                        label={`Delete ${u.name}`}
                        tone="bad"
                        onClick={() => setPendingDelete(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block">
              <Table head={["User", "Role", "Membership", "Joined", "Status", ""]}>
                {paged.map((u) => {
                  const isSelf = u.email === currentUserEmail;
                  return (
                    <Row key={u.id} className={cn(u.status !== "active" && "opacity-70")}>
                      <Cell className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine-50 text-sm font-bold uppercase text-wine-700">
                            {u.name.trim().charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-charcoal-700">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 text-xs font-normal text-charcoal-400">
                                  you
                                </span>
                              )}
                            </p>
                            <p className="flex items-center gap-1 truncate text-xs text-charcoal-400">
                              <Mail className="h-3 w-3" /> {u.email}
                            </p>
                          </div>
                        </div>
                      </Cell>
                      <Cell>
                        {u.role === "admin" ? (
                          <Pill tone="good">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                          </Pill>
                        ) : (
                          <Pill tone="neutral">Member</Pill>
                        )}
                      </Cell>
                      <Cell>
                        <Pill tone={MEMBERSHIP_TONE[u.membership]}>
                          {u.membership === "premium" && (
                            <Crown className="mr-1 h-3 w-3" />
                          )}
                          {u.membership}
                        </Pill>
                      </Cell>
                      <Cell className="whitespace-nowrap text-charcoal-500">
                        {new Date(u.joinedAt).toLocaleDateString()}
                      </Cell>
                      <Cell>
                        <Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill>
                      </Cell>
                      <Cell>
                        <RowActions>
                          <IconAction
                            label={`Delete ${u.name}`}
                            tone="bad"
                            onClick={() => setPendingDelete(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconAction>
                        </RowActions>
                      </Cell>
                    </Row>
                  );
                })}
              </Table>
            </div>
          </>
        )}
      </Card>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={visible.length}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete user?"
        confirmLabel="Delete user"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> and their profile will be permanently removed.
            This cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
