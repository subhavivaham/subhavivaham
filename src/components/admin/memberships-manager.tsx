"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Crown,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  RefreshCw,
  UserPlus,
  Sparkles,
  Eye,
  Upload,
} from "lucide-react";
import type {
  AdminUser,
  MembershipPayment,
  MembershipPlan,
  MembershipTier,
  PaymentStatus,
  Subscription,
  SubscriptionStatus,
} from "@/types";
import {
  approvePaymentAction,
  changeSubscriptionPlanAction,
  createSubscriptionAction,
  deletePlanAction,
  rejectPaymentAction,
  renewSubscriptionAction,
  setSubscriptionStatusAction,
  uploadPaymentScreenshotAction,
  upsertPlanAction,
  type ActionResult,
} from "@/app/(admin)/admin/actions";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import {
  AddButton,
  FilterTabs,
  PageHeader,
  Toolbar,
  ToolbarSelect,
} from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { PAYMENT_SCREENSHOT_ACCEPT } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

type SubFilter = "all" | SubscriptionStatus;

const SUB_TONE: Record<SubscriptionStatus, "good" | "warn" | "neutral"> = {
  active: "good",
  cancelled: "warn",
  expired: "neutral",
};

const PLAN_TONE: Record<MembershipTier, "neutral" | "warn" | "good"> = {
  free: "neutral",
  silver: "warn",
  premium: "good",
};

const PAY_TONE: Record<PaymentStatus, "good" | "warn" | "neutral"> = {
  pending: "warn",
  approved: "good",
  rejected: "neutral",
};

type PlanForm = {
  id?: string;
  name: MembershipTier;
  label: string;
  price: number;
  period: string;
  popular: boolean;
  features: string;
};

const emptyPlanForm: PlanForm = {
  name: "free",
  label: "",
  price: 0,
  period: "3 months",
  popular: false,
  features: "",
};

function planToForm(plan: MembershipPlan): PlanForm {
  return {
    id: plan.id,
    name: plan.name,
    label: plan.label,
    price: plan.price,
    period: plan.period,
    popular: Boolean(plan.popular),
    features: plan.features.map((f) => f.label).join("\n"),
  };
}

const PHOTO_LINE = /photo/i;
const INTEREST_LINE = /interest/i;

// the photo and interest counts live inside the feature text ("Upload up to 5
// photos", "Send 25 interests/month"), so the form reads the current number
// back out of that text and rewrites just that line when a count changes.
function featureCount(features: string, pattern: RegExp): number | null {
  const line = features.split("\n").find((entry) => pattern.test(entry));
  const match = line?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function photoLabel(count: number): string {
  return count === 1 ? "Upload 1 profile photo" : `Upload up to ${count} photos`;
}

function interestLabel(count: number): string {
  return count <= 0 ? "Unlimited interests" : `Send ${count} interests/month`;
}

function withFeatureLine(features: string, pattern: RegExp, label: string): string {
  const lines = features.split("\n");
  const index = lines.findIndex((line) => pattern.test(line));
  if (index === -1) {
    const trimmed = features.trim();
    return trimmed ? `${trimmed}\n${label}` : label;
  }
  lines[index] = label;
  return lines.join("\n");
}

function formToPlan(form: PlanForm): Omit<MembershipPlan, "id"> & { id?: string } {
  const interests = featureCount(form.features, INTEREST_LINE);
  return {
    ...(form.id ? { id: form.id } : {}),
    name: form.name,
    label: form.label.trim() || form.name,
    price: Number(form.price) || 0,
    labelPrice: `₹${Number(form.price) || 0}`,
    period: form.period,
    popular: form.popular,
    features: form.features
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ label: line, included: true })),
    photoLimit: featureCount(form.features, PHOTO_LINE) ?? 1,
    interestLimit: interests === null || interests <= 0 ? null : interests,
  };
}

export function MembershipsManager({
  initialPlans,
  initialSubscriptions,
  users,
  initialPayments,
}: {
  initialPlans: MembershipPlan[];
  initialSubscriptions: Subscription[];
  users: AdminUser[];
  initialPayments: MembershipPayment[];
}) {
  const toast = useToast();
  const [plans, setPlans] = useState<MembershipPlan[]>(initialPlans);
  const [subs, setSubs] = useState<Subscription[]>(initialSubscriptions);
  const [payments, setPayments] = useState<MembershipPayment[]>(initialPayments);
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [payFilter, setPayFilter] = useState<"all" | PaymentStatus>("pending");

  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const [pendingPlanDelete, setPendingPlanDelete] = useState<MembershipPlan | null>(null);

  const [addSubOpen, setAddSubOpen] = useState(false);
  const [subForm, setSubForm] = useState({ userId: "", plan: "silver" as MembershipTier });
  const [subError, setSubError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<MembershipPayment | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, startTransition] = useTransition();

  const applyPlans = (result: ActionResult<MembershipPlan[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setPlans(result.data);
    toast(message, "success");
    return true;
  };

  const applySubs = (result: ActionResult<Subscription[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setSubs(result.data);
    toast(message, "success");
    return true;
  };

  const applyPayments = (result: ActionResult<MembershipPayment[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setPayments(result.data);
    toast(message, "success");
    return true;
  };

  // the count fields are derived from the feature text, so editing the textarea
  // directly keeps them in step and neither is ever out of date.
  const photoCount = featureCount(planForm.features, PHOTO_LINE);
  const interestCount = featureCount(planForm.features, INTEREST_LINE);

  const subCounts = useMemo(
    () => ({
      all: subs.length,
      active: subs.filter((s) => s.status === "active").length,
      cancelled: subs.filter((s) => s.status === "cancelled").length,
      expired: subs.filter((s) => s.status === "expired").length,
    }),
    [subs]
  );

  const visibleSubs = useMemo(
    () => (subFilter === "all" ? subs : subs.filter((s) => s.status === subFilter)),
    [subs, subFilter]
  );

  const revenue = useMemo(
    () => subs.filter((s) => s.status === "active").reduce((sum, s) => sum + s.amount, 0),
    [subs]
  );

  const payCounts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((p) => p.status === "pending").length,
      approved: payments.filter((p) => p.status === "approved").length,
      rejected: payments.filter((p) => p.status === "rejected").length,
    }),
    [payments]
  );

  // pending requests are the ones that need a decision, so they lead whatever
  // view is open and everything else keeps its recency order.
  const visiblePayments = useMemo(() => {
    const filtered =
      payFilter === "all" ? payments : payments.filter((p) => p.status === payFilter);
    return [...filtered].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return 0;
    });
  }, [payments, payFilter]);

  const approvePayment = (payment: MembershipPayment) => {
    startTransition(async () => {
      const result = await approvePaymentAction(payment.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setPayments(result.data.payments);
      setSubs(result.data.subscriptions);
      toast(`${payment.memberName}'s ${payment.plan} plan activated.`, "success");
    });
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    const note = rejectNote;
    startTransition(async () => {
      const ok = applyPayments(
        await rejectPaymentAction(target.id, note),
        `Payment from ${target.memberName} rejected.`
      );
      if (ok) {
        setRejectTarget(null);
        setRejectNote("");
      }
    });
  };

  const uploadScreenshot = (payment: MembershipPayment, file: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.set("screenshot", file);
    startTransition(async () => {
      applyPayments(
        await uploadPaymentScreenshotAction(payment.id, formData),
        `Screenshot updated for ${payment.memberName}.`
      );
    });
  };

  const openCreatePlan = () => {
    setPlanForm(emptyPlanForm);
    setPlanErrors({});
    setPlanModal(true);
  };

  const openEditPlan = (plan: MembershipPlan) => {
    setPlanForm(planToForm(plan));
    setPlanErrors({});
    setPlanModal(true);
  };

  const savePlan = () => {
    const next: Record<string, string> = {};
    if (!planForm.label.trim()) next.label = "Display label is required.";
    if (Number(planForm.price) < 0) next.price = "Price cannot be negative.";
    setPlanErrors(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const ok = applyPlans(
        await upsertPlanAction(formToPlan(planForm)),
        planForm.id ? "Membership plan updated." : "Membership plan created."
      );
      if (ok) setPlanModal(false);
    });
  };

  const confirmPlanDelete = () => {
    if (!pendingPlanDelete) return;
    const target = pendingPlanDelete;
    setPendingPlanDelete(null);
    startTransition(async () => {
      applyPlans(await deletePlanAction(target.id), `${target.label} removed.`);
    });
  };

  const setSubStatus = (s: Subscription, status: SubscriptionStatus) => {
    startTransition(async () => {
      applySubs(
        await setSubscriptionStatusAction(s.id, status),
        `${s.memberName}'s subscription ${status}.`
      );
    });
  };

  const renew = (s: Subscription) => {
    // the server extends by the plan's own period, so the toast reads the same
    // duration back off the plan list rather than guessing
    const period = plans.find((p) => p.name === s.plan)?.period ?? "";
    startTransition(async () => {
      applySubs(
        await renewSubscriptionAction(s.id),
        `${s.memberName}'s subscription renewed${period ? ` for ${period}` : ""}.`
      );
    });
  };

  const changePlan = (s: Subscription, plan: MembershipTier) => {
    startTransition(async () => {
      applySubs(await changeSubscriptionPlanAction(s.id, plan), `${s.memberName} moved to ${plan}.`);
    });
  };

  const submitNewSub = () => {
    const user = users.find((u) => u.id === subForm.userId);
    if (!user) {
      setSubError("Choose a member.");
      return;
    }
    startTransition(async () => {
      const ok = applySubs(
        await createSubscriptionAction(user.id, subForm.plan),
        `${user.name} subscribed to ${subForm.plan}.`
      );
      if (ok) {
        setAddSubOpen(false);
        setSubForm({ userId: "", plan: "silver" });
        setSubError("");
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memberships"
        description={`${plans.length} plans · ${subCounts.active} active subscriptions · ₹${revenue.toLocaleString("en-IN")} active revenue.`}
        action={
          <div className="flex flex-wrap gap-2">
            <AddButton onClick={openCreatePlan}>Add plan</AddButton>
            <Button variant="outline" size="sm" onClick={() => setAddSubOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add subscription
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn("flex flex-col", plan.popular && "ring-2 ring-gold-400")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-display text-lg font-semibold text-charcoal-900">
                  {plan.name === "premium" && <Crown className="h-4 w-4 text-gold-500" />}
                  {plan.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-charcoal-900">
                  {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString("en-IN")}`}
                  {plan.price > 0 && (
                    <span className="text-sm font-normal text-charcoal-400"> / {plan.period}</span>
                  )}
                </p>
              </div>
              <Pill tone={PLAN_TONE[plan.name]}>
                {plan.popular ? <Sparkles className="mr-1 h-3 w-3" /> : null}
                {plan.popular ? "Popular" : plan.name}
              </Pill>
            </div>

            <ul className="mt-4 flex-1 space-y-1.5">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm text-charcoal-600">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  {f.label}
                </li>
              ))}
              {plan.features.length === 0 && (
                <li className="text-sm text-charcoal-400">No features listed yet.</li>
              )}
            </ul>

            <div className="mt-4 flex justify-end gap-1 border-t border-charcoal-50 pt-3">
              <RowActions>
                <IconAction label={`Edit ${plan.label}`} onClick={() => openEditPlan(plan)}>
                  <Pencil className="h-4 w-4" />
                </IconAction>
                <IconAction
                  label={`Delete ${plan.label}`}
                  tone="bad"
                  onClick={() => setPendingPlanDelete(plan)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconAction>
              </RowActions>
            </div>
          </Card>
        ))}
      </div>

      {/* the self-service queue: a member pays by UPI and uploads a screenshot,
          and this is where an admin reconciles it. approving writes the
          subscription and activates the plan. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-charcoal-900">
              Payment requests
            </h2>
            <p className="mt-0.5 text-sm text-charcoal-500">
              {payCounts.pending} pending · approve a request to activate the member&apos;s plan.
            </p>
          </div>
          <FilterTabs
            value={payFilter}
            onChange={setPayFilter}
            options={[
              { key: "pending", label: "Pending", count: payCounts.pending },
              { key: "approved", label: "Approved", count: payCounts.approved },
              { key: "rejected", label: "Rejected", count: payCounts.rejected },
              { key: "all", label: "All", count: payCounts.all },
            ]}
          />
        </div>

        <Card>
          <Table head={["Member", "Plan", "Amount", "Screenshot", "Status", ""]}>
            {visiblePayments.map((p) => (
              <Row key={p.id} className={cn(p.status === "rejected" && "opacity-60")}>
                <Cell className="font-semibold text-charcoal-700">{p.memberName}</Cell>
                <Cell>
                  <div className="flex items-center gap-2">
                    <Pill tone={PLAN_TONE[p.plan]}>{p.plan}</Pill>
                    <span className="text-xs text-charcoal-400">{p.planName}</span>
                  </div>
                </Cell>
                <Cell className="whitespace-nowrap text-charcoal-600">
                  {p.amount === 0 ? "—" : `₹${p.amount.toLocaleString("en-IN")}`}
                </Cell>
                <Cell>
                  {p.screenshotUrl ? (
                    <a
                      href={p.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`View ${p.memberName}'s screenshot`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-800"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-charcoal-300">—</span>
                  )}
                </Cell>
                <Cell>
                  <Pill tone={PAY_TONE[p.status]}>{p.status}</Pill>
                </Cell>
                <Cell>
                  <RowActions>
                    {p.status !== "approved" && (
                      <IconAction
                        label={`Approve ${p.memberName}'s payment`}
                        tone="good"
                        disabled={busy}
                        onClick={() => approvePayment(p)}
                      >
                        <Check className="h-4 w-4" />
                      </IconAction>
                    )}
                    {p.status !== "rejected" && (
                      <IconAction
                        label={`Reject ${p.memberName}'s payment`}
                        tone="bad"
                        disabled={busy}
                        onClick={() => {
                          setRejectNote("");
                          setRejectTarget(p);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </IconAction>
                    )}
                    <label
                      title={`Upload or replace ${p.memberName}'s screenshot`}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-800"
                    >
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept={PAYMENT_SCREENSHOT_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          uploadScreenshot(p, e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </RowActions>
                </Cell>
              </Row>
            ))}
            {visiblePayments.length === 0 && (
              <Row>
                <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={6}>
                  No payment requests in this view.
                </Cell>
              </Row>
            )}
          </Table>
        </Card>
      </div>

      <Toolbar>
        <FilterTabs
          value={subFilter}
          onChange={setSubFilter}
          options={[
            { key: "all", label: "All", count: subCounts.all },
            { key: "active", label: "Active", count: subCounts.active },
            { key: "cancelled", label: "Cancelled", count: subCounts.cancelled },
            { key: "expired", label: "Expired", count: subCounts.expired },
          ]}
        />
      </Toolbar>

      <Card
        action={
          <Pill tone="neutral">
            {visibleSubs.length} {visibleSubs.length === 1 ? "subscription" : "subscriptions"}
          </Pill>
        }
      >
        <Table head={["Member", "Plan", "Amount", "Renews on", "Status", ""]}>
          {visibleSubs.map((s) => (
            <Row key={s.id} className={cn(s.status !== "active" && "opacity-70")}>
              <Cell className="font-semibold text-charcoal-700">{s.memberName}</Cell>
              <Cell>
                <Pill tone={PLAN_TONE[s.plan]}>{s.plan}</Pill>
              </Cell>
              <Cell className="whitespace-nowrap text-charcoal-600">
                {s.amount === 0 ? "—" : `₹${s.amount.toLocaleString("en-IN")}`}
              </Cell>
              <Cell className="whitespace-nowrap text-charcoal-500">
                {s.renewsOn ? formatDate(s.renewsOn) : "—"}
              </Cell>
              <Cell>
                <Pill tone={SUB_TONE[s.status]}>{s.status}</Pill>
              </Cell>
              <Cell>
                <RowActions>
                  <ToolbarSelect
                    label=""
                    value={s.plan}
                    onChange={(v) => changePlan(s, v as MembershipTier)}
                    className="min-w-[112px]"
                  >
                    <option value="free">free</option>
                    <option value="silver">silver</option>
                    <option value="premium">premium</option>
                  </ToolbarSelect>

                  {s.status !== "active" ? (
                    <IconAction label={`Reactivate ${s.memberName}`} tone="good" onClick={() => setSubStatus(s, "active")}>
                      <Check className="h-4 w-4" />
                    </IconAction>
                  ) : (
                    <IconAction
                      label={`Cancel ${s.memberName}'s subscription`}
                      tone="warn"
                      onClick={() => setSubStatus(s, "cancelled")}
                    >
                      <X className="h-4 w-4" />
                    </IconAction>
                  )}

                  <IconAction label={`Renew ${s.memberName}'s subscription`} onClick={() => renew(s)}>
                    <RefreshCw className="h-4 w-4" />
                  </IconAction>
                </RowActions>
              </Cell>
            </Row>
          ))}
          {visibleSubs.length === 0 && (
            <Row>
              <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={6}>
                No subscriptions in this view.
              </Cell>
            </Row>
          )}
        </Table>
      </Card>

      <Modal
        open={planModal}
        onClose={() => setPlanModal(false)}
        size="md"
        dismissOnBackdrop={false}
        title={planForm.id ? `Edit ${planForm.label}` : "Add membership plan"}
        description="Changes are reflected on the public membership page immediately."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            savePlan();
          }}
        >
          {/* a plan's tier and label are fixed once it exists, so only a new
              plan needs to choose them; an edit starts at the price */}
          {!planForm.id && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Tier"
                value={planForm.name}
                onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value as MembershipTier }))}
              >
                <option value="free">free</option>
                <option value="silver">silver</option>
                <option value="premium">premium</option>
              </Select>
              <Input
                label="Display label"
                placeholder="e.g. Silver Membership"
                value={planForm.label}
                onChange={(e) => {
                  setPlanForm((f) => ({ ...f, label: e.target.value }));
                  setPlanErrors((er) => ({ ...er, label: "" }));
                }}
                error={planErrors.label}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Price (₹)"
              type="number"
              value={String(planForm.price)}
              onChange={(e) => setPlanForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
              error={planErrors.price}
            />
            <Input
              label="Period"
              placeholder="e.g. 3 months"
              value={planForm.period}
              onChange={(e) => setPlanForm((f) => ({ ...f, period: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Photos allowed"
              type="number"
              min={1}
              value={photoCount ?? ""}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next) || next < 1) return;
                setPlanForm((f) => ({
                  ...f,
                  features: withFeatureLine(f.features, PHOTO_LINE, photoLabel(next)),
                }));
              }}
              hint="Sets the photo upload cap for this plan."
            />
            <Input
              label="Interests / month"
              type="number"
              min={0}
              value={interestCount ?? ""}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next) || next < 0) return;
                setPlanForm((f) => ({
                  ...f,
                  features: withFeatureLine(f.features, INTEREST_LINE, interestLabel(next)),
                }));
              }}
              hint="0 means unlimited interests."
            />
          </div>

          <Textarea
            label="Features (one per line)"
            placeholder={"Show interest to 30 members\nPriority profile badge"}
            value={planForm.features}
            onChange={(e) => setPlanForm((f) => ({ ...f, features: e.target.value }))}
          />

          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input
              type="checkbox"
              checked={planForm.popular}
              onChange={(e) => setPlanForm((f) => ({ ...f, popular: e.target.checked }))}
              className="h-4 w-4 rounded border-charcoal-300 text-wine-700 focus:ring-wine-200"
            />
            Mark as the popular plan
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPlanModal(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Check className="h-4 w-4" /> {planForm.id ? "Save plan" : "Create plan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addSubOpen}
        onClose={() => setAddSubOpen(false)}
        size="sm"
        dismissOnBackdrop={false}
        title="Add subscription"
        description="Assign a plan to an existing member."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitNewSub();
          }}
        >
          <Select
            label="Member"
            value={subForm.userId}
            onChange={(e) => {
              setSubForm((f) => ({ ...f, userId: e.target.value }));
              setSubError("");
            }}
            error={subError}
          >
            <option value="">Select a member…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>
          <Select
            label="Plan"
            value={subForm.plan}
            onChange={(e) => setSubForm((f) => ({ ...f, plan: e.target.value as MembershipTier }))}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.name}>
                {p.label} — {p.price === 0 ? "Free" : `₹${p.price}`}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddSubOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Plus className="h-4 w-4" /> Add subscription
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null);
          setRejectNote("");
        }}
        size="sm"
        title="Reject payment?"
        description="The member will see this note on their payment request."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            confirmReject();
          }}
        >
          <Textarea
            label="Note (optional)"
            placeholder="Screenshot was unclear — please re-upload."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectNote("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              <X className="h-4 w-4" /> Reject payment
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingPlanDelete !== null}
        title="Delete membership plan?"
        confirmLabel="Delete plan"
        description={
          <>
            <strong>{pendingPlanDelete?.label}</strong> will no longer be offered. Existing
            subscriptions keep their current plan.
          </>
        }
        onConfirm={confirmPlanDelete}
        onClose={() => setPendingPlanDelete(null)}
      />
    </div>
  );
}
