"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Users,
  Check,
  X,
} from "lucide-react";
import type { Community } from "@/features/communities/data";
import type { CommunityInput } from "@/features/communities/store";
import {
  createCommunityAction,
  deleteCommunityAction,
  setCommunityActiveAction,
  updateCommunityAction,
  type ActionResult,
} from "@/app/(admin)/admin/actions";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import { AddButton, FilterTabs, PageHeader, SearchInput, Toolbar } from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";

type Filter = "all" | "active" | "inactive";

const emptyForm: CommunityInput = {
  name: "",
  tamilName: "",
  description: "",
  tamilDescription: "",
  visibleMembers: 0,
};

export function CommunitiesManager({
  initialCommunities,
  profileCountByCommunity,
}: {
  initialCommunities: Community[];
  profileCountByCommunity: Record<string, number>;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Community[]>(initialCommunities);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<Community | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CommunityInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<Community | null>(null);
  const [busy, startTransition] = useTransition();

  const apply = (result: ActionResult<Community[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setRows(result.data);
    toast(message, "success");
    return true;
  };

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((c) => c.active).length,
      inactive: rows.filter((c) => !c.active).length,
    }),
    [rows]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      const matchesFilter = filter === "all" || (filter === "active" ? c.active : !c.active);
      const matchesQuery =
        !q || c.name.toLowerCase().includes(q) || c.tamilName.includes(query.trim());
      return matchesFilter && matchesQuery;
    });
  }, [rows, filter, query]);

  const set = (key: keyof CommunityInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: key === "visibleMembers" ? Number(value) || 0 : value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setCreating(true);
  };

  const openEdit = (c: Community) => {
    setForm({
      name: c.name,
      tamilName: c.tamilName,
      description: c.description,
      tamilDescription: c.tamilDescription,
      visibleMembers: c.visibleMembers,
    });
    setErrors({});
    setEditing(c);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Community name is required.";
    else if (rows.some((c) => c.name.toLowerCase() === form.name.trim().toLowerCase() && c.id !== editing?.id))
      next.name = "A community with this name already exists.";
    if (!form.tamilName.trim()) next.tamilName = "Tamil name is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    const payload: CommunityInput = { ...form, name: form.name.trim(), tamilName: form.tamilName.trim() };
    if (editing) {
      startTransition(async () => {
        if (apply(await updateCommunityAction(editing.id, payload), `Community "${payload.name}" updated.`)) {
          close();
        }
      });
    } else {
      startTransition(async () => {
        if (apply(await createCommunityAction(payload), `Community "${payload.name}" added.`)) {
          close();
        }
      });
    }
  };

  const toggleActive = (c: Community) => {
    startTransition(async () => {
      apply(
        await setCommunityActiveAction(c.id, !c.active),
        `${c.name} ${c.active ? "deactivated" : "activated"}.`
      );
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      apply(await deleteCommunityAction(target.id), `Community "${target.name}" deleted.`);
    });
  };

  // the identity block, the profile count and the three row controls are the
  // same in the desktop row and in the phone row, so each is built once here
  const identity = (c: Community) => (
    <div className="min-w-0">
      <p className="truncate font-semibold text-charcoal-700">{c.name}</p>
      <p className="truncate text-xs text-charcoal-400">{c.description}</p>
    </div>
  );

  const profileCount = (c: Community) => profileCountByCommunity[c.name] ?? c.visibleMembers;

  const rowActions = (c: Community) => (
    <RowActions>
      <IconAction label={`Edit ${c.name}`} onClick={() => openEdit(c)}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      <IconAction
        label={c.active ? `Deactivate ${c.name}` : `Activate ${c.name}`}
        tone={c.active ? "warn" : "good"}
        onClick={() => toggleActive(c)}
      >
        {c.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      </IconAction>
      <IconAction label={`Delete ${c.name}`} tone="bad" onClick={() => setPendingDelete(c)}>
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </RowActions>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communities"
        description={`${counts.total} communities · ${counts.active} active · ${counts.inactive} inactive.`}
        action={<AddButton onClick={openCreate}>Add community</AddButton>}
      />

      <Toolbar>
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: counts.total },
            { key: "active", label: "Active", count: counts.active },
            { key: "inactive", label: "Inactive", count: counts.inactive },
          ]}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search communities…"
          className="w-full sm:w-72"
        />
      </Toolbar>

      <Card>
        {/* below md the six columns cannot fit a phone, so the same rows stay a
            table but each community becomes an identity row plus a
            label/value grid: every field is still there and the labels line up
            in one column. table-fixed because an auto-layout table measures a
            truncated cell by its full text width, so one long description would
            widen the table past the card and push the row actions off the edge.
            fixed layout takes the widths from the colgroup instead, and the
            wrapper catches anything that still exceeds them. the actions column
            is sized for the three 36px buttons plus their gaps. */}
        <div className="overflow-x-auto md:hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[7.5rem]" />
            </colgroup>
            {/* no divide-y here: each row is two table rows, so it would draw a
                line between the name and its own detail block. the rule goes
                under the detail row instead, which is exactly where one
                community ends. */}
            <tbody>
              {visible.map((c) => (
                <Fragment key={c.id}>
                  <Row>
                    <Cell className="py-3">{identity(c)}</Cell>
                    <Cell className="py-3">{rowActions(c)}</Cell>
                  </Row>
                  <Row className="border-b border-charcoal-50 last:border-b-0">
                    <Cell colSpan={2} className="pb-4">
                      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-xs">
                        <dt className="text-charcoal-400">Tamil</dt>
                        <dd className="truncate font-medium text-charcoal-700">{c.tamilName}</dd>
                        <dt className="text-charcoal-400">Profiles</dt>
                        <dd className="font-medium text-charcoal-700">
                          <Link
                            href={`/admin/profiles?community=${encodeURIComponent(c.name)}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-wine-700 hover:underline"
                          >
                            <Users className="h-3.5 w-3.5" /> {profileCount(c)}
                          </Link>
                        </dd>
                        {/* status is a row of the same grid, not a pill floating
                            under the labels, so it lands in the value column
                            with everything else */}
                        <dt className="text-charcoal-400">Status</dt>
                        <dd>
                          <Pill tone={c.active ? "good" : "neutral"}>
                            {c.active ? "Active" : "Inactive"}
                          </Pill>
                        </dd>
                      </dl>
                    </Cell>
                  </Row>
                </Fragment>
              ))}
              {visible.length === 0 && (
                <Row>
                  <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={2}>
                    No communities match this view.
                  </Cell>
                </Row>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden md:block">
          <Table head={["Community", "Tamil", "Profiles", "Status", ""]}>
            {visible.map((c) => (
              <Row key={c.id}>
                <Cell>{identity(c)}</Cell>
                <Cell>{c.tamilName}</Cell>
                <Cell>
                  <Link
                    href={`/admin/profiles?community=${encodeURIComponent(c.name)}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-wine-700 hover:underline"
                  >
                    <Users className="h-3.5 w-3.5" /> {profileCount(c)}
                  </Link>
                </Cell>
                <Cell>
                  <Pill tone={c.active ? "good" : "neutral"}>
                    {c.active ? "Active" : "Inactive"}
                  </Pill>
                </Cell>
                <Cell>{rowActions(c)}</Cell>
              </Row>
            ))}
            {visible.length === 0 && (
              <Row>
                <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={5}>
                  No communities match this view.
                </Cell>
              </Row>
            )}
          </Table>
        </div>
      </Card>

      <Modal
        open={creating || editing !== null}
        onClose={close}
        size="lg"
        dismissOnBackdrop={false}
        title={editing ? `Edit ${editing.name}` : "Add community"}
        description="Communities power the public directory, filters and profile grouping."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Community name"
              placeholder="e.g. Iyer"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              error={errors.name}
            />
            <Input
              label="Tamil name"
              placeholder="e.g. ஐயர்"
              value={form.tamilName}
              onChange={(e) => set("tamilName")(e.target.value)}
              error={errors.tamilName}
            />
          </div>
          <Input
            label="Visible members"
            type="number"
            min={0}
            value={String(form.visibleMembers)}
            // once the community exists the count is derived, not typed: it is
            // recomputed from the profiles table whenever a profile is added,
            // removed or moved to another community, so the box is locked while
            // editing. on create it still seeds a community that has no linked
            // profiles yet, and the first profile to land takes it over.
            disabled={editing !== null}
            onChange={(e) => set("visibleMembers")(e.target.value)}
            hint={
              editing
                ? "Recalculated from linked profiles on every profile change."
                : "Starting count until profiles are linked."
            }
          />
          <Textarea
            label="Description"
            placeholder="Short English description shown on the community page."
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            error={errors.description}
          />
          <Textarea
            label="Tamil description"
            placeholder="தமிழ் விவரம்"
            value={form.tamilDescription}
            onChange={(e) => set("tamilDescription")(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Check className="h-4 w-4" /> {editing ? "Save changes" : "Add community"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete community?"
        confirmLabel="Delete"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be removed from the directory and
            unlinked from the community filter. Profiles are not deleted.
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
