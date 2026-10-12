"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Trash2,
  Eye,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Receipt,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import type {
  AdminUser,
  Gender,
  MembershipPayment,
  MembershipTier,
  Profile,
  ProfilePhoto,
  ProfileStatus,
} from "@/types";
import {
  createProfileAction,
  deleteProfileAction,
  setProfileStatusAction,
  setProfileVerifiedAction,
  setUserMembershipAction,
  type ActionResult,
} from "@/app/(admin)/admin/actions";
import { emptyProfileDraft, type ProfileInput } from "@/features/profiles/store";
import {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MIN_PHOTOS,
  PHOTO_TYPES,
  photoSizeError,
} from "@/lib/constants";
import { ABOUT_MIN, ageFromDob } from "@/lib/registration";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import {
  ProfileForm,
  SECTIONS,
  firstSectionWithErrors,
  type ProfileSection,
} from "@/components/admin/profile-form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import {
  BasicDetailsCard,
  EducationCareerCard,
  FamilyDetailsCard,
  LifestyleCard,
  OverviewCard,
  PartnerPreferenceCard,
  SectionCard,
} from "@/components/profile/profile-sections";
import { PhotoGallery } from "@/components/profile/photo-gallery";
import {
  AddButton,
  FilterTabs,
  PageHeader,
  Pagination,
  SearchInput,
  Toolbar,
  ToolbarSelect,
} from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { cn } from "@/lib/utils";

type GenderTab = "all" | Gender;
type StatusFilter = "all" | ProfileStatus | "unverified";

const STATUS_TONE = {
  active: "good",
  inactive: "neutral",
  rejected: "bad",
} as const;

type SelectTone = "good" | "warn" | "bad" | "neutral";

const MEMBERSHIP_TONE: Record<MembershipTier, SelectTone> = {
  free: "good",
  silver: "neutral",
  premium: "warn",
};

// only the fill and text change per state; the border stays the same so a row of
// these reads as one control rather than three differently framed widgets
const SELECT_TONE: Record<SelectTone, string> = {
  good: "border-charcoal-200 bg-emerald-50 text-emerald-700",
  warn: "border-charcoal-200 bg-gold-50 text-gold-700",
  bad: "border-charcoal-200 bg-red-50 text-red-600",
  neutral: "border-charcoal-200 bg-charcoal-50 text-charcoal-600",
};

// the membership, verification and status columns used to be read-only pills.
// each is now the control itself: picking a value writes straight to postgres,
// so the admin no longer has to find the matching row-action button.
function InlineSelect({
  value,
  tone,
  label,
  disabled,
  onChange,
  children,
}: {
  value: string;
  tone: SelectTone;
  label: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full max-w-[8.5rem] cursor-pointer rounded-lg border px-2 text-xs font-semibold capitalize shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-wine-100 disabled:cursor-not-allowed disabled:opacity-60",
        SELECT_TONE[tone]
      )}
    >
      {children}
    </select>
  );
}

// nothing is ever edited here, only added, so the form never has a saved photo
// to show. a module-level constant keeps the prop referentially stable across
// renders instead of handing the form a fresh [] every time
const NO_PHOTOS: ProfilePhoto[] = [];

const PAGE_SIZE = 20;

// the wording the status pills use, reused as the option labels in the mobile
// filter sheet and in the summary line beside its button
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
  rejected: "Rejected",
  unverified: "Unverified only",
};

// same idea for the gender pills, minus the counts: inside the filter sheet the
// label is all that is needed to pick one
const GENDER_LABELS: Record<GenderTab, string> = {
  all: "All",
  female: "Brides",
  male: "Grooms",
};

// one entry per picked image, held in the browser until the admin presses
// upload. the object url is only the on-screen preview, so it is revoked as soon
// as the photo is dropped or the modal is left.
interface PendingPhoto {
  id: string;
  file: File;
  preview: string;
}

export function ProfilesManager({
  initialProfiles,
  users,
  communityNames,
  payments,
}: {
  initialProfiles: Profile[];
  users: AdminUser[];
  communityNames: string[];
  payments: MembershipPayment[];
}) {
  const toast = useToast();

  const [rows, setRows] = useState<Profile[]>(initialProfiles);
  // membership lives on the user, not the profile. props carry the database
  // truth, but a tier change is also held here so the dropdown flips the moment
  // the action returns instead of waiting for the revalidated props.
  const [membershipEdits, setMembershipEdits] = useState<Record<string, MembershipTier>>({});
  const [tab, setTab] = useState<GenderTab>("all");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState<Gender | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);
  // the profile being inspected from the eye action, shown read-only in a modal
  // so an admin can check every filled-in detail before verifying it
  const [viewing, setViewing] = useState<Profile | null>(null);
  // the member's uploaded payment proof, shown in a modal rather than a new tab
  // so the admin keeps their place in the profiles list
  const [viewingScreenshot, setViewingScreenshot] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const [form, setForm] = useState<ProfileInput>(emptyProfileDraft("female"));
  const [section, setSection] = useState<ProfileSection>("basics");
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [photoNotice, setPhotoNotice] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, startTransition] = useTransition();

  // object urls outlive the component unless they are released. removals revoke
  // their own url, so this only has to cover the ones still held at unmount -
  // hence the ref, since an effect keyed on pending would revoke live previews
  // on every change.
  const pendingRef = useRef<PendingPhoto[]>([]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      for (const photo of pendingRef.current) URL.revokeObjectURL(photo.preview);
    },
    []
  );

  const apply = (result: ActionResult<Profile[]>, message: string, tone: "success" | "info") => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setRows(result.data);
    toast(message, tone);
    return true;
  };

  const locations = useMemo(
    () => Array.from(new Set(rows.map((p) => p.city).filter(Boolean))).sort(),
    [rows]
  );

  const membershipByUser = useMemo(() => {
    const map: Record<string, MembershipTier> = {};
    users.forEach((u) => {
      map[u.id] = u.membership;
    });
    for (const [id, tier] of Object.entries(membershipEdits)) map[id] = tier;
    return map;
  }, [users, membershipEdits]);

  // the member's most recent payment proof, keyed by user id, so the profiles
  // row can offer a look at the screenshot the member uploaded. a pending
  // request wins over an older settled one, since that is the one waiting on the
  // admin to verify.
  const paymentByUser = useMemo(() => {
    const map: Record<string, MembershipPayment> = {};
    for (const payment of payments) {
      if (!payment.screenshotUrl) continue;
      const current = map[payment.userId];
      if (!current || (current.status !== "pending" && payment.status === "pending")) {
        map[payment.userId] = payment;
      }
    }
    return map;
  }, [payments]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      female: rows.filter((p) => p.gender === "female").length,
      male: rows.filter((p) => p.gender === "male").length,
      pending: rows.filter((p) => !p.verified).length,
    }),
    [rows]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (tab !== "all" && p.gender !== tab) return false;
      if (location !== "all" && p.city !== location) return false;
      if (status === "unverified" && p.verified) return false;
      if (status !== "all" && status !== "unverified" && p.status !== status) return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.profession.toLowerCase().includes(q) ||
        p.community.toLowerCase().includes(q)
      );
    });
}, [rows, tab, query, location, status]);

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

  // any narrowing of the list sends the admin back to the first page, otherwise a
  // search or filter applied on page 3 can land on an empty one
  const pickTab = (next: GenderTab) => {
    setTab(next);
    setPage(1);
  };
  const pickLocation = (next: string) => {
    setLocation(next);
    setPage(1);
  };
  const pickStatus = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };
  const search = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  // what the select and the gender pills currently narrow by, in the order they
  // appear, so the mobile button can say what is active without the admin opening
  // it first
  const activeFilters = [
    tab !== "all" ? GENDER_LABELS[tab] : null,
    location !== "all" ? location : null,
    status !== "all" ? STATUS_LABELS[status] : null,
  ].filter((v): v is string => v !== null);

  const set = <K extends keyof ProfileInput,>(key: K, value: ProfileInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const openCreate = (gender: Gender) => {
    setForm(emptyProfileDraft(gender));
    setErrors({});
    setSection("basics");
    setPending((prev) => {
      for (const photo of prev) URL.revokeObjectURL(photo.preview);
      return [];
    });
    setPhotoNotice("");
    setCreating(gender);
  };

  const closeForm = () => {
    setPending((prev) => {
      for (const photo of prev) URL.revokeObjectURL(photo.preview);
      return [];
    });
    setPhotoNotice("");
    setCreating(null);
  };

  const getSectionErrors = (secKey: ProfileSection) => {
    const secErrors: Record<string, string> = {};
    if (secKey === "basics") {
      if (!form.fullName.trim()) secErrors.fullName = "Full name is required.";
      if (!form.dateOfBirth) secErrors.dateOfBirth = "Date of birth is required.";
      else {
        const age = ageFromDob(form.dateOfBirth);
        if (Number.isNaN(age) || age > 100) secErrors.dateOfBirth = "Enter a valid date of birth.";
        else if (age < 18) secErrors.dateOfBirth = "The member must be at least 18.";
      }
      if (!form.height || form.height < 100) secErrors.height = "Choose a height.";
      if (!form.maritalStatus) secErrors.maritalStatus = "Marital status is required.";
    }
    if (secKey === "background") {
      if (!form.religion) secErrors.religion = "Religion is required.";
      if (!form.community.trim()) secErrors.community = "Community is required.";
      if (!form.motherTongue) secErrors.motherTongue = "Mother tongue is required.";
      if (!form.education) secErrors.education = "Education is required.";
      if (!form.profession) secErrors.profession = "Profession is required.";
    }
    if (secKey === "family") {
      if (!form.familyType) secErrors.familyType = "Family type is required.";
    }
    if (secKey === "lifestyle") {
      if (!form.diet) secErrors.diet = "Diet is required.";
      if (!form.smoking) secErrors.smoking = "Smoking habit is required.";
      if (!form.drinking) secErrors.drinking = "Drinking habit is required.";
    }
    if (secKey === "location") {
      if (!form.district) secErrors.district = "District is required.";
      if (!form.city.trim()) secErrors.city = "City is required.";
      const aboutLength = form.about.trim().length;
      if (aboutLength < ABOUT_MIN)
        secErrors.about = `Add a little more — ${ABOUT_MIN - aboutLength} more characters needed.`;
    }
    if (secKey === "preferences") {
      if (form.prefMaxAge <= form.prefMinAge)
        secErrors.prefMaxAge = "Maximum age must be greater than the minimum.";
      if (form.prefMaxHeight < form.prefMinHeight)
        secErrors.prefMaxHeight = "Maximum height cannot be below the minimum.";
    }
    if (secKey === "photos") {
      if (pending.length < MIN_PHOTOS) {
        secErrors.photos = `Attach at least ${MIN_PHOTOS} photo so members can recognise the profile.`;
      }
    }
    return secErrors;
  };

  // the same bar the registration wizard applies, so a profile an admin types in
  // is no thinner than one a member submitted themselves
  const validate = () => {
    let next: Record<string, string> = {};
    for (const s of SECTIONS) {
      next = { ...next, ...getSectionErrors(s.key) };
    }
    setErrors(next);
    return next;
  };

  const save = () => {
    const found = validate();
    if (Object.keys(found).length > 0) {
      // send the admin to the tab holding the first problem rather than leaving
      // them on whichever section they happened to be looking at
      setSection(firstSectionWithErrors(found) ?? section);
      return;
    }
    const gender = creating;
    const files = pending.map((photo) => photo.file);
    startTransition(async () => {
      if (
        apply(
          await createProfileAction(form, files),
          `${gender === "male" ? "Groom" : "Bride"} profile for ${form.fullName} created and verified.`,
          "success"
        )
      ) {
        closeForm();
      }
    });
  };

  // no profile is being edited here, so every slot is up for grabs: the only
  // photos that exist are the ones picked for this new profile
  const photoSlotsLeft = Math.max(0, MAX_PHOTOS - pending.length);

  const currentSectionIndex = SECTIONS.findIndex((s) => s.key === section);
  const isLastSection = section === "photos" || currentSectionIndex === SECTIONS.length - 1;

  const handleNextSection = () => {
    const secErrors = getSectionErrors(section);
    if (Object.keys(secErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...secErrors }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      const currentFields = SECTIONS[currentSectionIndex]?.fields ?? [];
      for (const f of currentFields) delete next[f];
      return next;
    });
    if (currentSectionIndex < SECTIONS.length - 1) {
      setSection(SECTIONS[currentSectionIndex + 1].key);
    }
  };

  // the register form's rules, applied while picking so an admin is told before
  // anything is uploaded. addProfilePhotoUploadAction re-checks all of them.
  const onPhotosPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // let the same file be picked again after it was dropped
    e.target.value = "";
    if (picked.length === 0) return;

    const accepted: PendingPhoto[] = [];
    const rejected: string[] = [];

    for (const file of picked) {
      if (photoSlotsLeft - accepted.length <= 0) {
        rejected.push(`${file.name} — only ${MAX_PHOTOS} photos per profile`);
        continue;
      }
      if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
        rejected.push(`${file.name} — must be JPEG, PNG or WebP`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        rejected.push(`${file.name} — ${photoSizeError(file.size).split("— ")[1]}`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }

    setPending((prev) => [...prev, ...accepted]);
    setPhotoNotice(rejected.join("; "));
  };

  const dropPending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((photo) => photo.id !== id);
    });
    setPhotoNotice("");
  };

  // the dropdowns are the only place verification and status are set, so the
  // picked value is the target state rather than a toggle
  const changeVerified = (p: Profile, verified: boolean) => {
    startTransition(async () => {
      apply(
        await setProfileVerifiedAction(p.id, verified),
        verified
          ? `${p.fullName} approved and verified.`
          : `Verification removed for ${p.fullName}.`,
        verified ? "success" : "info"
      );
    });
  };

  const changeStatus = (p: Profile, next: ProfileStatus) => {
    startTransition(async () => {
      apply(await setProfileStatusAction(p.id, next), `${p.fullName} marked ${next}.`, "info");
    });
  };

  const changeMembership = (p: Profile, tier: MembershipTier) => {
    startTransition(async () => {
      const result = await setUserMembershipAction(p.userId, tier);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setMembershipEdits((prev) => ({ ...prev, [p.userId]: tier }));
      toast(`${p.fullName} membership set to ${tier}.`, "info");
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      apply(await deleteProfileAction(target.id), `Profile for ${target.fullName} deleted.`, "info");
    });
  };

  // the identity block and the row controls are the same in the desktop
  // row and in the phone row, so they are built once here
  const identity = (p: Profile) => {
    const photo = p.photos.find((ph) => ph.isPrimary) ?? p.photos[0];
    return (
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-100 text-xs font-bold text-charcoal-500">
          {photo ? (
            <Image src={photo.url} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            p.firstName.charAt(0)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-charcoal-700">
            {p.fullName} <span className="font-normal text-charcoal-400">· {p.age}</span>
          </p>
          <p className="truncate text-xs capitalize text-charcoal-400">
            {p.gender} · {p.profession}
          </p>
        </div>
      </div>
    );
  };

  const membershipSelect = (p: Profile) => {
    const membership = membershipByUser[p.userId] ?? "free";
    return (
      <InlineSelect
        value={membership}
        tone={MEMBERSHIP_TONE[membership]}
        label={`Membership for ${p.fullName}`}
        disabled={busy}
        onChange={(v) => changeMembership(p, v as MembershipTier)}
      >
        <option value="free">free</option>
        <option value="silver">silver</option>
        <option value="premium">premium</option>
      </InlineSelect>
    );
  };

  const verificationSelect = (p: Profile) => (
    <InlineSelect
      value={p.verified ? "verified" : "pending"}
      tone={p.verified ? "good" : "warn"}
      label={`Verification for ${p.fullName}`}
      disabled={busy}
      onChange={(v) => changeVerified(p, v === "verified")}
    >
      <option value="verified">verified</option>
      <option value="pending">pending</option>
    </InlineSelect>
  );

  const statusSelect = (p: Profile) => (
    <InlineSelect
      value={p.status}
      tone={STATUS_TONE[p.status]}
      label={`Status for ${p.fullName}`}
      disabled={busy}
      onChange={(v) => changeStatus(p, v as ProfileStatus)}
    >
      <option value="active">active</option>
      <option value="inactive">inactive</option>
      <option value="rejected">rejected</option>
    </InlineSelect>
  );

  const rowActions = (p: Profile) => {
    const payment = paymentByUser[p.userId];
    return (
      <RowActions>
        <IconAction label={`View ${p.fullName}'s profile`} onClick={() => setViewing(p)}>
          <Eye className="h-4 w-4" />
        </IconAction>
        {payment && (
          <IconAction
            label={`View ${p.fullName}'s payment screenshot`}
            onClick={() =>
              setViewingScreenshot({ url: payment.screenshotUrl, name: p.fullName })
            }
          >
            <Receipt className="h-4 w-4" />
          </IconAction>
        )}
        <IconAction label={`Delete ${p.fullName}`} tone="bad" onClick={() => setPendingDelete(p)}>
          <Trash2 className="h-4 w-4" />
        </IconAction>
      </RowActions>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description={`${counts.all} member profiles · ${counts.pending} awaiting verification.`}
        action={
          <div className="flex flex-wrap gap-2">
            <AddButton onClick={() => openCreate("female")}>Add bride</AddButton>
            <AddButton onClick={() => openCreate("male")}>Add groom</AddButton>
          </div>
        }
      />

      {/* from md the gender pills sit on their own row above the toolbar; below it
          they live in the filter sheet instead, so the phone gets one row of
          controls rather than two stacked ones */}
      <div className="hidden md:block">
        <FilterTabs
          value={tab}
          onChange={pickTab}
          options={[
            { key: "all", label: "All", count: counts.all },
            { key: "female", label: "Brides", count: counts.female },
            { key: "male", label: "Grooms", count: counts.male },
          ]}
        />
      </div>

      <Toolbar>
        <SearchInput
          value={query}
          onChange={search}
          placeholder="Search name, city, profession…"
          className="w-full sm:w-72"
        />

        {/* two labelled selects side by side need more width than a phone has,
            so below md they collapse into one Filter button that opens the same
            two choices as chip rows - the treatment the users page uses */}
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          <ToolbarSelect label="Location" value={location} onChange={pickLocation}>
            <option value="all">All locations</option>
            {locations.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect
            label="Status"
            value={status}
            onChange={(v) => pickStatus(v as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="rejected">Rejected</option>
            <option value="unverified">Unverified only</option>
          </ToolbarSelect>
        </div>

        <div className="flex w-full items-center justify-between gap-3 md:hidden">
          <p className="min-w-0 truncate text-sm text-charcoal-600">
            <span className="font-semibold text-charcoal-900">
              {activeFilters.length > 0 ? activeFilters.join(" · ") : "All profiles"}
            </span>
            <span className="text-charcoal-400"> · {visible.length} shown</span>
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Filter profiles"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-charcoal-200 bg-white px-3.5 text-sm font-semibold text-charcoal-700 shadow-sm transition-colors hover:border-wine-300 hover:bg-wine-50 hover:text-wine-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilters.length > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-wine-700" aria-hidden />
            )}
          </button>
        </div>
      </Toolbar>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter profiles"
        size="sm"
        centerOnMobile
      >
        <div className="space-y-5">
          {[
            {
              label: "Gender",
              value: tab,
              options: (Object.keys(GENDER_LABELS) as GenderTab[]).map((key) => ({
                key,
                label: GENDER_LABELS[key],
              })),
              onChange: (v: string) => pickTab(v as GenderTab),
            },
            {
              label: "Location",
              value: location,
              options: [
                { key: "all", label: "All locations" },
                ...locations.map((city) => ({ key: city, label: city })),
              ],
              onChange: (v: string) => pickLocation(v),
            },
            {
              label: "Status",
              value: status,
              options: (Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => ({
                key,
                label: STATUS_LABELS[key],
              })),
              onChange: (v: string) => pickStatus(v as StatusFilter),
            },
          ].map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                {group.label}
              </p>
              <FilterTabs
                value={group.value}
                onChange={group.onChange}
                options={group.options}
              />
            </div>
          ))}

          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Show {visible.length} {visible.length === 1 ? "profile" : "profiles"}
          </Button>
        </div>
      </Modal>

      <Card
        action={
          <Pill tone="neutral">
            {visible.length} {visible.length === 1 ? "profile" : "profiles"}
          </Pill>
        }
      >
        {/* below md the eight columns cannot fit a phone, so the same rows stay
            a table but each profile becomes an identity row plus a
            label/value grid: every field is still there and the labels line up
            in one column. table-fixed because an auto-layout table measures a
            truncated cell by its full text width, so one long community name
            would widen the table past the card and push the row actions off the
            edge. fixed layout takes the widths from the colgroup instead, and
            the wrapper catches anything that still exceeds them. the actions
            column holds two 36px buttons plus their gap. */}
        <div className="overflow-x-auto md:hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[5.5rem]" />
            </colgroup>
            {/* no divide-y here: each profile is two rows, so it would draw a
                line between the name and its own detail block. the rule goes
                under the detail row instead, which is exactly where one profile
                ends. */}
            <tbody>
              {paged.map((p) => (
                <Fragment key={p.id}>
                  <Row>
                    <Cell className="py-3">{identity(p)}</Cell>
                    <Cell className="py-3">{rowActions(p)}</Cell>
                  </Row>
                  <Row className="border-b border-charcoal-50 last:border-b-0">
                    <Cell colSpan={2} className="pb-4">
                      {/* two pairs share a row, label over value, so six fields
                          take three rows instead of six. a four-column
                          label-then-value grid was the alternative, but it
                          leaves each value a sliver too narrow for a control. */}
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Community</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {p.community}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Location</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {[p.city, p.state].filter(Boolean).join(", ")}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Created</dt>
                          <dd className="whitespace-nowrap text-sm font-medium text-charcoal-700">
                            {new Date(p.profileCreatedOn).toLocaleDateString()}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Membership</dt>
                          <dd>{membershipSelect(p)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Verification</dt>
                          <dd>{verificationSelect(p)}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Status</dt>
                          <dd>{statusSelect(p)}</dd>
                        </div>
                      </dl>
                    </Cell>
                  </Row>
                </Fragment>
              ))}
              {visible.length === 0 && (
                <Row>
                  <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={2}>
                    No profiles match these filters.
                  </Cell>
                </Row>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden md:block">
          <Table
            head={[
              "Profile",
              "Community",
              "Location",
              "Membership",
              "Created",
              "Verification",
              "Status",
              "",
            ]}
          >
            {paged.map((p) => (
              <Row key={p.id}>
                <Cell className="min-w-[220px]">{identity(p)}</Cell>
                <Cell>{p.community}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-500">
                  {p.city}, {p.state}
                </Cell>
                <Cell>{membershipSelect(p)}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-500">
                  {new Date(p.profileCreatedOn).toLocaleDateString()}
                </Cell>
                <Cell>{verificationSelect(p)}</Cell>
                <Cell>{statusSelect(p)}</Cell>
                <Cell>{rowActions(p)}</Cell>
              </Row>
            ))}
            {visible.length === 0 && (
              <Row>
                <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={8}>
                  No profiles match these filters.
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
        open={creating !== null}
        onClose={closeForm}
        size="xl"
        title={`Add ${creating === "male" ? "groom" : "bride"} profile`}
        description="Profiles an admin adds are published and verified straight away. Use the row actions to hide or unverify one later."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (creating && !isLastSection) {
              handleNextSection();
            } else {
              save();
            }
          }}
        >
          {Object.keys(errors).length > 0 && (
            <p
              role="alert"
              className="rounded-xl border border-wine-100 bg-wine-50 px-4 py-3 text-sm font-medium text-wine-700"
            >
              Please fix the highlighted {Object.keys(errors).length === 1 ? "field" : "fields"} to save.
            </p>
          )}

          <ProfileForm
            form={form}
            errors={errors}
            section={section}
            onSectionChange={setSection}
            onSet={set}
            communityNames={communityNames}
            photos={pending}
            photoSlotsLeft={photoSlotsLeft}
            photoNotice={photoNotice}
            existingPhotos={NO_PHOTOS}
            onPhotosPicked={onPhotosPicked}
            onPhotoDropped={dropPending}
            disableGender={creating !== null}
          />

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={closeForm}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              {currentSectionIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSection(SECTIONS[currentSectionIndex - 1].key)}
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isLastSection ? (
                <Button type="button" onClick={handleNextSection}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  <Check className="h-4 w-4" /> Create profile
                </Button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* read-only: the same section cards the member-facing detail view renders,
          so an admin verifies against exactly what a viewer would see. membership,
          verification and status stay on the row dropdowns, not in here. */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        size="xl"
        title={viewing ? viewing.fullName : "Profile"}
        description={
          viewing
            ? `${viewing.gender === "male" ? "Groom" : "Bride"} · ${viewing.profession} · ${[
                viewing.city,
                viewing.state,
              ]
                .filter(Boolean)
                .join(", ")}`
            : undefined
        }
      >
        {viewing && (
          <div className="space-y-5">
            <OverviewCard profile={viewing} />
            <div className="grid gap-5 lg:grid-cols-2">
              <BasicDetailsCard profile={viewing} />
              <EducationCareerCard profile={viewing} />
              <FamilyDetailsCard profile={viewing} />
              <LifestyleCard profile={viewing} />
            </div>
            <PartnerPreferenceCard profile={viewing} />
            {viewing.photos.length > 0 && (
              <SectionCard title="Photos">
                <PhotoGallery photos={viewing.photos} name={viewing.fullName} />
              </SectionCard>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={viewingScreenshot !== null}
        onClose={() => setViewingScreenshot(null)}
        size="lg"
        title={viewingScreenshot ? `${viewingScreenshot.name}'s payment screenshot` : "Payment screenshot"}
      >
        {viewingScreenshot && (
          <div className="space-y-4">
            <Image
              src={viewingScreenshot.url}
              alt={`${viewingScreenshot.name}'s payment screenshot`}
              width={1080}
              height={1080}
              unoptimized
              className="mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-charcoal-100 object-contain"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete profile?"
        confirmLabel="Delete profile"
        description={
          <>
            <strong>{pendingDelete?.fullName}</strong> and{" "}
            {pendingDelete?.photos.length ?? 0} photo(s) will be permanently removed from the
            admin list. This cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
