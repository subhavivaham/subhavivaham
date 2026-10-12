"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Building2,
  BookUser,
  CookingPot,
  PartyPopper,
  Camera,
  Sparkles,
  SlidersHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import { FilterTabs, PageHeader, Pagination, SearchInput } from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { cn } from "@/lib/utils";
import {
  approveServiceAction,
  createServiceAction,
  deleteServiceAction,
  rejectServiceAction,
  setServiceActiveAction,
  updateServiceAction,
  type ActionResult,
} from "@/app/(admin)/admin/actions";
import type { ServiceInput } from "@/features/services/data";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPES,
  type ServiceProvider,
  type ServiceType,
} from "@/features/services/types";

const TYPE_ICONS: Record<ServiceType, LucideIcon> = {
  mandapam: Building2,
  broker: BookUser,
  catering: CookingPot,
  event: PartyPopper,
  photography: Camera,
  decoration: Sparkles,
};

const TYPE_TONES: Record<ServiceType, "good" | "warn" | "bad" | "neutral"> = {
  mandapam: "neutral",
  broker: "warn",
  catering: "good",
  event: "neutral",
  photography: "good",
  decoration: "warn",
};

type Filter = ServiceType | "all";

const PAGE_SIZE = 20;

const emptyForm: ServiceInput = {
  name: "",
  type: "mandapam",
  contact: "",
  city: "",
  address: "",
  phone: "",
  details: "",
};

export function ServicesManager({
  initialServices,
}: {
  initialServices: ServiceProvider[];
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [providers, setProviders] = useState<ServiceProvider[]>(initialServices);
  const [form, setForm] = useState<ServiceInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<ServiceProvider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceProvider | null>(null);
  const [pendingReject, setPendingReject] = useState<ServiceProvider | null>(null);
  const [busy, startTransition] = useTransition();

  const apply = (result: ActionResult<ServiceProvider[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setProviders(result.data);
    toast(message, "success");
    return true;
  };

  const counts = useMemo(() => {
    // a row counts toward a category only if it is actually on the public page,
    // which needs both gates. pending and switched-off rows are counted separately
    // so the review queue cannot hide inside a category total.
    const byType = providers.reduce<Record<ServiceType, number>>(
      (acc, p) => {
        if (p.isApproved && p.active) acc[p.type] += 1;
        return acc;
      },
      { mandapam: 0, broker: 0, catering: 0, event: 0, photography: 0, decoration: 0 }
    );
    return {
      total: providers.filter((p) => p.isApproved && p.active).length,
      pending: providers.filter((p) => !p.isApproved).length,
      inactive: providers.filter((p) => p.isApproved && !p.active).length,
      byType,
    };
  }, [providers]);

  // pending first. a new submission is the one row that needs a decision, and
  // sorting it to the top means an admin sees the queue without filtering.
  const ordered = useMemo(
    () => [...providers].sort((a, b) => Number(a.isApproved) - Number(b.isApproved)),
    [providers]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((p) => {
      if (filter !== "all" && p.type !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.contact.toLowerCase().includes(q)
      );
    });
  }, [ordered, filter, query]);

  // the page number is pulled back into range on every render rather than in an
  // effect, which would leave one paint showing an empty table first
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [visible, currentPage]
  );

  // any change to the filter or the search text sends the admin back to the
  // first page, otherwise a search on page 3 can land on an empty one
  const changeFilter = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  const search = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  // the identity block and the row controls are the same in the desktop row and
  // in the phone row, so each is built once here
  const identity = (p: ServiceProvider) => {
    const Icon = TYPE_ICONS[p.type];
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine-50 text-wine-700">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-charcoal-700">
            {p.name}
            {!p.isApproved && (
              <span className="ml-2 text-xs font-medium text-gold-700">Not approved</span>
            )}
          </p>
          {p.details && <p className="truncate text-xs text-charcoal-400">{p.details}</p>}
        </div>
      </div>
    );
  };

  const statusPill = (p: ServiceProvider) => {
    if (!p.isApproved) return <Pill tone="warn">Pending</Pill>;
    if (!p.active) return <Pill tone="neutral">Off</Pill>;
    return <Pill tone="good">Live</Pill>;
  };

  const rowActions = (p: ServiceProvider) => (
    <RowActions>
      {/* approve is the only path from pending onto the public page, so it sits
          first and is the widest target on a pending row */}
      {!p.isApproved && (
        <IconAction label={`Approve ${p.name}`} tone="good" onClick={() => approve(p)}>
          <CheckCircle2 className="h-4 w-4" />
        </IconAction>
      )}
      {/* hiding an approved listing keeps its approval, so it can be switched
          back on later without a second review */}
      {p.isApproved && (
        <IconAction
          label={p.active ? `Hide ${p.name}` : `Show ${p.name}`}
          tone="warn"
          onClick={() => toggleActive(p)}
        >
          {p.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </IconAction>
      )}
      <IconAction label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      {!p.isApproved && (
        <IconAction
          label={`Not approve ${p.name}`}
          tone="bad"
          onClick={() => setPendingReject(p)}
        >
          <XCircle className="h-4 w-4" />
        </IconAction>
      )}
      <IconAction label={`Remove ${p.name}`} tone="bad" onClick={() => setPendingDelete(p)}>
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </RowActions>
  );

  const set = (key: keyof ServiceInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Vendor name is required.";
    if (!form.city.trim()) next.city = "City is required.";
    // the same rule the public form applies, so an admin cannot approve a
    // mandapam listing that the vendor was told to give an address for
    if (form.type === "mandapam" && !form.address.trim())
      next.address = "Hall address is required.";
    if (!form.phone.trim()) next.phone = "Phone number is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setEditing(null);
    setModalOpen(true);
  };

  const submit = () => {
    if (!validate()) return;
    const payload: ServiceInput = {
      name: form.name.trim(),
      type: form.type,
      contact: form.contact.trim(),
      city: form.city.trim(),
      // cleared for anything that is not a mandapam, matching the public form, so
      // a hall that is re-categorised does not keep advertising a street address
      address: form.type === "mandapam" ? form.address.trim() : "",
      phone: form.phone.trim(),
      details: form.details.trim(),
    };
    if (editing) {
      startTransition(async () => {
        if (apply(await updateServiceAction(editing.id, payload), `${payload.name} updated.`)) {
          closeModal();
        }
      });
    } else {
      startTransition(async () => {
        if (apply(await createServiceAction(payload), "Vendor added successfully.")) {
          closeModal();
        }
      });
    }
  };

  const openEdit = (p: ServiceProvider) => {
    setForm({
      name: p.name,
      type: p.type,
      contact: p.contact,
      city: p.city,
      address: p.address,
      phone: p.phone,
      details: p.details,
    });
    setErrors({});
    setEditing(p);
    setModalOpen(true);
  };

  const toggleActive = (p: ServiceProvider) => {
    startTransition(async () => {
      apply(
        await setServiceActiveAction(p.id, !p.active),
        p.active ? `${p.name} hidden from the public site.` : `${p.name} is now listed publicly.`
      );
    });
  };

  const approve = (p: ServiceProvider) => {
    startTransition(async () => {
      apply(await approveServiceAction(p.id), `${p.name} approved and listed publicly.`);
    });
  };

  const confirmReject = () => {
    if (!pendingReject) return;
    const target = pendingReject;
    setPendingReject(null);
    startTransition(async () => {
      apply(await rejectServiceAction(target.id), `${target.name} not approved and kept off the site.`);
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      apply(await deleteServiceAction(target.id), `${target.name} removed.`);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Services"
        description="Manage mandapams, Franchise Partners, catering, photography, decoration and event partners."
        action={
          <Button size="sm" onClick={openCreate} loading={busy}>
            <Plus className="h-4 w-4" /> Add provider
          </Button>
        }
      />

      {/* the filter stays reachable while a member scrolls a long list, and
          clears the sticky site header (h-16, h-20 from sm up), same treatment
          as the public services directory: pills on lg+, a sheet on mobile */}
      <div className="sticky top-16 z-30 -mx-4 mb-10 bg-ivory-50/90 px-4 py-4 backdrop-blur-md sm:top-20 sm:-mx-6 sm:px-6">
        <div className="hidden justify-center lg:flex">
          <FilterTabs
            value={filter}
            onChange={changeFilter}
            options={[
              { key: "all", label: "All", count: counts.total },
              ...SERVICE_TYPES.map((t) => ({
                key: t,
                label: SERVICE_TYPE_LABELS[t],
                count: counts.byType[t],
              })),
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="min-w-0 text-sm text-charcoal-600">
            <span className="font-semibold text-charcoal-900">
              {filter === "all" ? "All" : SERVICE_TYPE_LABELS[filter]}
            </span>
            <span className="text-charcoal-400"> · {visible.length} listed</span>
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filter services"
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
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter services"
        size="sm"
        centerOnMobile
      >
        <ul className="space-y-2">
          {([{ key: "all" as Filter, label: "All" }, ...SERVICE_TYPES.map((t) => ({ key: t as Filter, label: SERVICE_TYPE_LABELS[t] }))]).map((option) => {
            const isActive = option.key === filter;
            const OptionIcon = option.key === "all" ? Building2 : TYPE_ICONS[option.key as ServiceType];
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
                  <span className="flex min-w-0 items-center gap-2.5">
                    <OptionIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{option.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          value={query}
          onChange={search}
          placeholder="Search vendor, city, contact…"
          className="w-full sm:w-64"
        />
      </div>

      <Card
        action={
          <div className="flex items-center gap-2">
            {counts.pending > 0 && <Pill tone="warn">{counts.pending} pending</Pill>}
            {counts.inactive > 0 && <Pill tone="neutral">{counts.inactive} off</Pill>}
            <Pill tone="neutral">
              {visible.length} {visible.length === 1 ? "provider" : "providers"}
            </Pill>
          </div>
        }
      >
        {/* below md the eight columns cannot fit a phone, so the same rows stay
            a table but each provider becomes an identity row plus a
            label/value grid: every field is still there and the labels line up
            in one column. table-fixed because an auto-layout table measures a
            truncated cell by its full text width, so one long vendor name would
            widen the table past the card and push the row actions off the edge.
            fixed layout takes the widths from the colgroup instead, and the
            wrapper catches anything that still exceeds them. the actions column
            is sized for the four 36px buttons plus their gaps. */}
        <div className="overflow-x-auto lg:hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[10rem]" />
            </colgroup>
            {/* no divide-y here: each provider is two rows, so it would draw a
                line between the name and its own detail block. the rule goes
                under the detail row instead, which is exactly where one provider
                ends. */}
            <tbody>
              {paged.map((p) => (
                <Fragment key={p.id}>
                  <Row className={p.isApproved ? undefined : "bg-gold-50/30"}>
                    <Cell className="py-3">{identity(p)}</Cell>
                    <Cell className="py-3">{rowActions(p)}</Cell>
                  </Row>
                  <Row
                    className={cn(
                      "border-b border-charcoal-50 last:border-b-0",
                      !p.isApproved && "bg-gold-50/30"
                    )}
                  >
                    <Cell colSpan={2} className="pb-4">
                      {/* two pairs share a row, label over value, so six fields
                          take three rows instead of six. a four-column
                          label-then-value grid was the alternative, but it
                          leaves each value a sliver too narrow for a pill. */}
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Contact</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {p.contact || "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Category</dt>
                          <dd>
                            <Pill tone={TYPE_TONES[p.type]}>{SERVICE_TYPE_LABELS[p.type]}</Pill>
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">City</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {p.city}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Phone</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {p.phone}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Added</dt>
                          <dd className="whitespace-nowrap text-sm font-medium text-charcoal-700">
                            {new Date(p.addedAt).toLocaleDateString()}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Status</dt>
                          <dd>{statusPill(p)}</dd>
                        </div>
                      </dl>
                    </Cell>
                  </Row>
                </Fragment>
              ))}
              {visible.length === 0 && (
                <Row>
                  <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={2}>
                    No providers in this category yet.
                  </Cell>
                </Row>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden lg:block">
          <Table head={["Provider", "Category", "Contact", "City", "Phone", "Added", "Status", ""]}>
            {paged.map((p) => (
              <Row key={p.id} className={p.isApproved ? undefined : "bg-gold-50/30"}>
                <Cell className="max-w-[240px]">{identity(p)}</Cell>
                <Cell>
                  <Pill tone={TYPE_TONES[p.type]}>{SERVICE_TYPE_LABELS[p.type]}</Pill>
                </Cell>
                <Cell className="text-charcoal-600">{p.contact || "—"}</Cell>
                <Cell className="text-charcoal-600">{p.city}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-600">{p.phone}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-400">
                  {new Date(p.addedAt).toLocaleDateString()}
                </Cell>
                <Cell>{statusPill(p)}</Cell>
                <Cell>{rowActions(p)}</Cell>
              </Row>
            ))}
            {visible.length === 0 && (
              <Row>
                <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={8}>
                  No providers in this category yet.
                </Cell>
              </Row>
            )}
          </Table>
        </div>
      </Card>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        total={visible.length}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="md"
        title={editing ? `Edit ${editing.name}` : "Add new provider"}
        description={
          editing
            ? "Update the vendor details shown on the public services page."
            : "New providers are published to the public services page immediately."
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={form.type} onChange={(e) => set("type")(e.target.value)}>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <Input
              label="Vendor name"
              placeholder="e.g. Sri Murugan Kalyana Mandapam"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              error={errors.name}
            />
            <Input
              label="Contact person"
              placeholder="e.g. K. Senthil"
              value={form.contact}
              onChange={(e) => set("contact")(e.target.value)}
            />
            <Input
              label="City"
              placeholder="e.g. Tuticorin"
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              error={errors.city}
            />
            {/* mandapam only, same as the public form: the hall is somewhere a
                family has to drive to, and the city alone is not an address */}
            {form.type === "mandapam" && (
              <Input
                label="Hall address"
                placeholder="e.g. 12, Gandhi Nagar, Tirunelveli Main Road"
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                error={errors.address}
              />
            )}
            <Input
              label="Phone"
              type="tel"
              placeholder="e.g. 88839 43711"
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              error={errors.phone}
            />
          </div>
          <Textarea
            label="Details"
            placeholder="Capacity, services offered…"
            value={form.details}
            onChange={(e) => set("details")(e.target.value)}
            className="min-h-[88px]"
          />
          <div className="flex flex-col-reverse gap-2 border-t border-charcoal-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeModal} className="w-full sm:w-auto">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" loading={busy} className="w-full sm:w-auto">
              <Check className="h-4 w-4" /> {editing ? "Save changes" : "Add provider"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove provider?"
        confirmLabel="Remove provider"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be removed from the vendor list. Use
            &ldquo;Hide&rdquo; instead if you only want to pause it.
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      {/* not the same as deleting. the row and its details stay, so the vendor can
          be approved later without asking them to fill the form again. */}
      <ConfirmDialog
        open={pendingReject !== null}
        title="Not approve this listing?"
        confirmLabel="Not approve"
        description={
          <>
            <strong>{pendingReject?.name}</strong> will not be published, and the details are kept
            in case you want to approve it later. Delete it instead if the submission should be
            gone for good.
          </>
        }
        onConfirm={confirmReject}
        onClose={() => setPendingReject(null)}
      />
    </div>
  );
}
