"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Plus,
  Landmark,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Card, Table, Row, Cell, Pill } from "@/components/admin/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { IconAction, RowActions } from "@/components/admin/row-actions";
import { PageHeader, Pagination, SearchInput } from "@/components/admin/shared";
import { useToast } from "@/lib/state/toast-provider";
import { cn, formatDate } from "@/lib/utils";
import {
  addTempleImagesAction,
  approveTempleAction,
  createTempleAction,
  deleteTempleAction,
  deleteTempleImageAction,
  rejectTempleAction,
  reorderTempleImagesAction,
  saveTempleServicesAction,
  saveTempleFestivalsAction,
  setTempleActiveAction,
  updateTempleAction,
  type ActionResult,
  type TempleCover,
} from "@/app/(admin)/admin/actions";
import {
  MAX_TEMPLE_IMAGES,
  MAX_TEMPLE_IMAGE_BYTES,
  TEMPLE_IMAGE_ACCEPT,
  TEMPLE_IMAGE_TYPES,
  formatBytes,
  templeImageSizeError,
} from "@/lib/constants";
import {
  isGoogleMapsUrl,
  isHttpUrl,
  TEMPLE_DAYS,
  type Temple,
  type TempleInput,
} from "@/features/temples/types";

const emptyForm: TempleInput = {
  name: "",
  nameTa: "",
  deity: "",
  address: "",
  city: "",
  district: "",
  state: "",
  country: "India",
  mapsUrl: "",
  history: "",
  // seven empty day boxes, Sunday first. filled from TEMPLE_DAYS so the order
  // matches the columns and the public page.
  timings: TEMPLE_DAYS.map(() => ""),
  contact: "",
  whatsapp: "",
  email: "",
  contactPerson: "",
  website: "",
};

const emptyCover: TempleCover = { mode: "url", url: "", file: null };

const PAGE_SIZE = 20;

export function TemplesManager({ initialTemples }: { initialTemples: Temple[] }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [temples, setTemples] = useState<Temple[]>(initialTemples);
  const [form, setForm] = useState<TempleInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Temple | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Temple | null>(null);
  const [pendingReject, setPendingReject] = useState<Temple | null>(null);
  const [busy, startTransition] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [imageError, setImageError] = useState("");
  // the cover is deliberately not part of TempleInput: it is a file or a url,
  // never a plain string, and it is sent alongside the form rather than inside
  // it. the preview url is derived from the picked file so create can show the
  // operator what they chose before anything is uploaded.
  const [cover, setCover] = useState<TempleCover>(emptyCover);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverError, setCoverError] = useState("");
  // festivals are held as an editable list rather than saved per row, so the
  // whole set is written in one action when the form is saved. held apart from
  // TempleInput because a festival is a pair of values, not a flat field.
  const [festivals, setFestivals] = useState<{ name: string; happensOn: string }[]>([]);
  // services are held the same way. price is a string here even though the column
  // is an integer, so a half-typed "2500" does not turn into 25 in the box while
  // the admin is still typing it; it is parsed once on submit.
  const [services, setServices] = useState<{ name: string; details: string; price: string }[]>([]);

// the object url for a picked cover is ours, not the browser's, so it has to be
  // released or the blob stays pinned for the life of the document. revoked in the
  // updater rather than in an effect, matching how profiles-manager releases its
  // photo previews. the unmount case — an admin navigating away with the modal
  // open — needs a ref, but it is written in an effect rather than during render:
  // a ref mutated mid-render is not safe under concurrent rendering.
  const clearCoverPreview = () => {
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  };
  const coverPreviewRef = useRef(coverPreview);
  useEffect(() => {
    coverPreviewRef.current = coverPreview;
  }, [coverPreview]);
  useEffect(
    () => () => {
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    },
    []
  );

  const apply = (result: ActionResult<Temple[]>, message: string) => {
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    setTemples(result.data);
    toast(message, "success");
    return true;
  };

  const counts = useMemo(
    () => ({
      total: temples.filter((t) => t.isApproved && t.active).length,
      pending: temples.filter((t) => !t.isApproved).length,
      inactive: temples.filter((t) => t.isApproved && !t.active).length,
    }),
    [temples]
  );

  // pending first — a new submission is the one row that needs a decision
  const ordered = useMemo(
    () => [...temples].sort((a, b) => Number(a.isApproved) - Number(b.isApproved)),
    [temples]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((t) => {
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.deity.toLowerCase().includes(q) ||
        t.contact.toLowerCase().includes(q)
      );
    });
  }, [ordered, query]);

  // the page number is pulled back into range on every render rather than in an
  // effect, which would leave one paint showing an empty table first
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [visible, currentPage]
  );

  // a new search sends the admin back to the first page, otherwise a search typed
  // on page 3 can land on an empty one
  const search = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  // the identity block, the status pill and the row controls are the same in the
  // desktop row and in the phone row, so each is built once here
  const identity = (t: Temple) => (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine-50 text-wine-700">
        <Landmark className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-charcoal-700">
          {t.name}
          {!t.isApproved && (
            <span className="ml-2 text-xs font-medium text-gold-700">Not approved</span>
          )}
        </p>
        {t.history && <p className="truncate text-xs text-charcoal-400">{t.history}</p>}
      </div>
    </div>
  );

  const statusPill = (t: Temple) => {
    if (!t.isApproved) return <Pill tone="warn">Pending</Pill>;
    if (!t.active) return <Pill tone="neutral">Off</Pill>;
    return <Pill tone="good">Live</Pill>;
  };

  // the image count is a count rather than the list because MAX_TEMPLE_IMAGES is
  // a hard cap: an admin needs to see how many slots are gone before trying
  const imageCount = (t: Temple) => `${t.images.length}/${MAX_TEMPLE_IMAGES}`;

  // and a count, not the hours: seven strings would wrap a phone row to several
  // lines. the edit form is where the hours are read.
  const timingCount = (t: Temple) =>
    t.timings.some((timing) => timing.hours)
      ? `${t.timings.filter((timing) => timing.hours).length}/7 days`
      : "—";

  const rowActions = (t: Temple) => (
    <RowActions>
      {!t.isApproved && (
        <IconAction label={`Approve ${t.name}`} tone="good" onClick={() => approve(t)}>
          <CheckCircle2 className="h-4 w-4" />
        </IconAction>
      )}
      {t.isApproved && (
        <IconAction
          label={t.active ? `Hide ${t.name}` : `Show ${t.name}`}
          tone="warn"
          onClick={() => toggleActive(t)}
        >
          {t.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </IconAction>
      )}
      <IconAction label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
        <Pencil className="h-4 w-4" />
      </IconAction>
      {!t.isApproved && (
        <IconAction
          label={`Not approve ${t.name}`}
          tone="bad"
          onClick={() => setPendingReject(t)}
        >
          <XCircle className="h-4 w-4" />
        </IconAction>
      )}
      <IconAction label={`Remove ${t.name}`} tone="bad" onClick={() => setPendingDelete(t)}>
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </RowActions>
  );

  // Clears a field's error as soon as it is edited, so a form the operator is
  // actively fixing does not keep shouting at them. The message is not re-derived
  // on every keystroke: it is re-derived on the next submit, which is the point
  // where it is enforced.
  const set = (key: keyof TempleInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  // same idea for the festival rows, keyed "festival-<index>" to match validate()
  const clearFestivalError = (index: number) => {
    const key = `festival-${index}`;
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  // and for the service rows, keyed "service-<index>"
  const clearServiceError = (index: number) => {
    const key = `service-${index}`;
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  // Client-side validation. It exists to give the operator a message next to the
  // field they need to fix, not to enforce anything — every rule here is
  // re-checked in templeRow / saveTempleFestivalsAction on the server, because a
  // client check is a convenience and a crafted request skips it entirely.
  //
  // messages say what is missing and nothing else. the reason a field is required
  // belongs in the label and the hint, not in the error the operator reads five
  // times while fixing one form.
  const validate = () => {
    const next: Record<string, string> = {};

    // name is the link text, the page title and half the map query, so a temple
    // without one cannot be identified at all
    if (!form.name.trim()) {
      next.name = "Temple name is required.";
    } else if (form.name.trim().length > 120) {
      // the detail page puts this in an h1 and the admin table has one column for
      // it, so a very long name breaks both layouts rather than just wrapping
      next.name = "Keep the name under 120 characters.";
    }

    if (!form.address.trim()) next.address = "Address is required.";
    if (!form.city.trim()) next.city = "City is required.";
    if (!form.district.trim()) next.district = "District is required.";
    if (!form.nameTa.trim()) next.nameTa = "Name in Tamil is required.";
    if (!form.contactPerson.trim()) next.contactPerson = "Contact person is required.";

    // contact is how a visitor reaches the temple, so it is required rather than
    // optional. the shape check only runs once it has something to check.
    if (!form.contact.trim()) {
      next.contact = "Phone number is required.";
    } else if (!/^[0-9+()\s.-]{7,20}$/.test(form.contact.trim())) {
      // digits, spaces, +, -, (), and the dot some operators use. anything else
      // produces a tel: link that does not dial
      next.contact = "That does not look like a phone number.";
    }

    const whatsapp = form.whatsapp.trim();
    if (!whatsapp) {
      next.whatsapp = "WhatsApp number is required.";
    } else if (!/^[0-9+()\s.-]{7,20}$/.test(whatsapp)) {
      next.whatsapp = "That does not look like a phone number.";
    }

    if (!form.mapsUrl.trim()) {
      next.mapsUrl = "Google Maps link is required.";
    } else if (!isGoogleMapsUrl(form.mapsUrl.trim())) {
      next.mapsUrl = "That is not a Google Maps link.";
    }

    // history renders as the whole "About this temple" panel, so blank is the
    // page's main content missing rather than a thin page
    if (!form.history.trim()) {
      next.history = "History is required.";
    } else if (form.history.trim().length < 40) {
      // a handful of words is not a description. 40 is short enough that nobody
      // writes filler to satisfy it and long enough to catch a stray character
      next.history = "Write at least a sentence or two about this temple.";
    }

    // ---- optional fields, validated only if filled --------------------

    if (form.email.trim() && !form.email.trim().includes("@")) {
      next.email = "That email address does not look valid.";
    }

    // becomes an href, so a value that is not a url is worse than no value
    if (form.website.trim() && !isHttpUrl(form.website.trim())) {
      next.website = "Start with http:// or https://";
    }

    // festivals: a row with no name is a row that renders as a blank line. the
    // date is optional because festivals follow the lunar calendar and the temple
    // may not have fixed it yet.
    festivals.forEach((festival, index) => {
      if (!festival.name.trim()) {
        next[`festival-${index}`] = "Festival name is required.";
      }
      const date = festival.happensOn.trim();
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        next[`festival-${index}`] = "Pick the date from the calendar.";
      }
    });

    // services: same rule as festivals for the name, plus the price. digits only,
    // because the column is an integer and a decimal would be rejected by the
    // server after the temple row had already been written. 0 is allowed and is
    // not the same as blank: it is what renders as "On request".
    services.forEach((service, index) => {
      if (!service.name.trim()) {
        next[`service-${index}`] = "Service name is required.";
      }
      const price = service.price.trim();
      if (price && !/^\d+$/.test(price)) {
        next[`service-${index}`] = "Price must be a whole number of rupees.";
      }
    });

    setErrors(next);
    // returned rather than a boolean, so the caller can act on the same object it
    // just set without waiting for a re-render
    return next;
  };

  // scroll the first invalid field into view rather than leaving the operator to
  // hunt for red text in a long form. run in a timeout because the error state is
  // only in the DOM after this render.
  const focusFirstError = (errors: Record<string, string>) => {
    const first = Object.keys(errors)[0];
    if (!first) return;
    setTimeout(() => {
      document
        .querySelector(`[data-field="${first}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setPendingFiles([]);
    setImageError("");
    setCover(emptyCover);
    clearCoverPreview();
  };

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setEditing(null);
    setPendingFiles([]);
    setImageError("");
    setCover(emptyCover);
    clearCoverPreview();
    // reset, so reopening create after an edit does not leave the previous
    // temple's festivals on screen
    setFestivals([]);
    setServices([]);
    setModalOpen(true);
  };

  const submit = () => {
    // validate() returns the errors it set rather than only a boolean, so the same
    // object drives both the messages and the scroll. reading it from state here
    // would be the previous render's value.
    const found = validate();
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    const payload: TempleInput = {
      name: form.name.trim(),
      nameTa: form.nameTa.trim(),
      deity: form.deity.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
country: form.country.trim() || "India",
      mapsUrl: form.mapsUrl.trim(),
      history: form.history.trim(),
      timings: form.timings,
      contact: form.contact.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      contactPerson: form.contactPerson.trim(),
website: form.website.trim(),
    };
    // in url mode an empty box clears the cover, which is how an operator
    // removes one. in upload mode a missing file is not an error — it means
    // "leave whatever is already there", so an edit that never touched the cover
    // does not blank it.
    const sent: TempleCover =
      cover.mode === "url"
        ? { mode: "url", url: cover.url.trim(), file: null }
        : cover.file
          ? { mode: "upload", url: "", file: cover.file }
          : { mode: "url", url: editing?.coverImage ?? "", file: null };

    if (editing) {
      startTransition(async () => {
        // festivals are saved after the temple row. the row has to succeed
        // first: it is the foreign key the festival rows point at, and a create
        // that failed would leave every festival orphaned.
        if (!apply(await updateTempleAction(editing.id, payload, sent), `${payload.name} updated.`))
          return;
        if (
          !apply(
            await saveTempleFestivalsAction(editing.id, festivals),
            `${payload.name} updated.`
          )
        )
          return;
        // services the same way. saved even when the list is empty: an admin who
        // removed the last package has to be able to clear it, and skipping the
        // call on an empty list would leave the old rows on the public page.
        if (
          !apply(
            await saveTempleServicesAction(editing.id, services),
            `${payload.name} updated.`
          )
        )
          return;
        // staged gallery files go up with the form, the same as on create. the id
        // is already known here, so there is no set-difference to do.
        if (pendingFiles.length > 0) {
          const uploaded = await addTempleImagesAction(editing.id, pendingFiles);
          if (!uploaded.ok) {
            toast(uploaded.error, "error");
            return;
          }
          apply(uploaded, `${payload.name} updated.`);
        }
        closeModal();
      });
    } else {
      startTransition(async () => {
        // ids already on screen before the insert. the action returns the whole
        // refreshed list, not the created row, so the new id is found by
        // set-difference rather than by position — the list is ordered by
        // added_at and a re-save can put the new row anywhere in it.
        const before = new Set(temples.map((t) => t.id));
        const created = await createTempleAction(payload, sent);
        // narrowed here rather than through apply(), because the id lookup below
        // needs created.data and apply() only reports success as a boolean
        if (!created.ok) {
          toast(created.error, "error");
          return;
        }
        apply(created, "Temple added successfully.");

        const added = created.data.find((t) => !before.has(t.id));
        if (!added) {
          // the row is saved but its id cannot be identified, so the festivals and
          // images picked in this form would be dropped without trace. say so.
          toast("Temple added, but its festivals, packages and photos were not saved.", "error");
          closeModal();
          return;
        }

        if (festivals.length > 0) {
          if (
            !apply(
              await saveTempleFestivalsAction(added.id, festivals),
              "Temple added successfully."
            )
          )
            return;
        }
        // nothing to write on a create with no packages, unlike the edit path
        if (services.length > 0) {
          if (
            !apply(
              await saveTempleServicesAction(added.id, services),
              "Temple added successfully."
            )
          )
            return;
        }
        if (pendingFiles.length > 0) {
          if (
            !apply(
              await addTempleImagesAction(added.id, pendingFiles),
              "Temple added successfully."
            )
          )
            return;
        }
        closeModal();
      });
    }
  };

  const openEdit = (t: Temple) => {
    setForm({
      name: t.name,
      nameTa: t.nameTa,
      deity: t.deity,
      address: t.address,
      city: t.city,
      district: t.district,
      state: t.state,
country: t.country,
      mapsUrl: t.mapsUrl,
      history: t.history,
      // t.timings always holds seven entries in TEMPLE_DAYS order, so this is a
      // straight index-for-index copy back into the form boxes
      timings: TEMPLE_DAYS.map((_, index) => t.timings[index]?.hours ?? ""),
      contact: t.contact,
      whatsapp: t.whatsapp,
      email: t.email,
      contactPerson: t.contactPerson,
      website: t.website,
    });
    setErrors({});
    // the admin list is unsorted by date, so festivals arrive in the order they
    // were entered. that is the order the operator sees and edits.
    setFestivals(
      [...t.festivals]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((festival) => ({ name: festival.name, happensOn: festival.happensOn }))
    );
    // packages are already in sort_order — the admin query orders by it and the
    // mapper keeps that sequence — so they are copied straight across. price 0 is
    // kept as "0" rather than "" so the box shows what is stored: 0 is what
    // renders as "On request" on the public page.
    setServices(
      t.services.map((service) => ({
        name: service.name,
        details: service.details,
        price: service.price > 0 ? String(service.price) : "0",
      }))
    );
    setPendingFiles([]);
    setImageError("");
    // a saved cover is a url whether it was pasted or uploaded, so an edit
    // always opens on the url tab with the current value in it
setCover({ mode: "url", url: t.coverImage, file: null });
    clearCoverPreview();
    setCoverError("");
    setEditing(t);
    setModalOpen(true);
  };

  // one index per day, matching TEMPLE_DAYS order. replaced, not mutated, so the
  // input it re-renders actually sees the new value.
  const setTiming = (index: number, hours: string) => {
    setForm((prev) => {
      const timings = TEMPLE_DAYS.map((_, i) => prev.timings[i] ?? "");
      timings[index] = hours;
      return { ...prev, timings };
    });
  };

  const addFestival = () => {
    setFestivals((prev) => [...prev, { name: "", happensOn: "" }]);
  };
  // replaced rather than mutated, so the state identity changes and the input
  // this re-renders actually sees the new value
  const updateFestival = (index: number, patch: Partial<{ name: string; happensOn: string }>) => {
    setFestivals((prev) => prev.map((festival, i) => (i === index ? { ...festival, ...patch } : festival)));
    clearFestivalError(index);
  };
  const removeFestival = (index: number) => {
    setFestivals((prev) => prev.filter((_, i) => i !== index));
    // indices shift up after a removal, so the remaining rows' keys are all one
    // lower. dropping the removed one and shifting the rest keeps an error showing
    // against the wrong festival after a delete.
    setErrors((e) => {
      const next: Record<string, string> = {};
      for (const [key, message] of Object.entries(e)) {
        const match = /^festival-(\d+)$/.exec(key);
        if (!match) {
          next[key] = message;
          continue;
        }
        const at = Number(match[1]);
        if (at < index) next[key] = message;
        else if (at > index) next[`festival-${at - 1}`] = message;
        // at === index is the removed row, so its error goes with it
      }
      return next;
    });
  };

  const addService = () => {
    // priced "0" rather than blank: 0 is a real, saveable state meaning "On
    // request", and a blank box would leave an admin guessing which one they get
    setServices((prev) => [...prev, { name: "", details: "", price: "0" }]);
  };
  const updateService = (
    index: number,
    patch: Partial<{ name: string; details: string; price: string }>
  ) => {
    setServices((prev) => prev.map((service, i) => (i === index ? { ...service, ...patch } : service)));
    clearServiceError(index);
  };
  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
    // same index shift as removeFestival, for the same reason
    setErrors((e) => {
      const next: Record<string, string> = {};
      for (const [key, message] of Object.entries(e)) {
        const match = /^service-(\d+)$/.exec(key);
        if (!match) {
          next[key] = message;
          continue;
        }
        const at = Number(match[1]);
        if (at < index) next[key] = message;
        else if (at > index) next[`service-${at - 1}`] = message;
      }
      return next;
    });
  };

  const toggleActive = (t: Temple) => {
    startTransition(async () => {
      apply(
        await setTempleActiveAction(t.id, !t.active),
        t.active ? `${t.name} hidden from the public site.` : `${t.name} is now listed publicly.`
      );
    });
  };

  // -- cover and gallery -------------------------------------------------
  // images are held as File[] until upload rather than uploaded on select, so
  // one bad file in a batch of five does not cost the other four. the slot check
  // runs here too so the file picker can stop the operator before they pick,
  // and again in the action, because a client check is a convenience and not a
  // guarantee.
  //
// the cover counts as one of the five. it lives on temples.cover_image rather
  // than in temple_images, so it is added to the gallery count here — otherwise
  // an operator could set a cover and then fill all five gallery slots and the
  // page would show six images.
  //
  // a cover chosen in this form but not yet saved still counts, or the picker
  // would happily let an admin stage five gallery files plus a cover that is
  // about to be saved and blow the cap on the server instead of here.
  const coverCounted =
    editing?.coverImage || (cover.mode === "upload" && cover.file) || (cover.mode === "url" && cover.url)
      ? 1
      : 0;

  // files already staged count against the budget, or picking a second batch
  // would show the same slots twice and let the total go past the cap.
  const savedImages = editing?.images.length ?? 0;
  const usedSlots = savedImages + coverCounted + pendingFiles.length;
  const slotsLeft = Math.max(0, MAX_TEMPLE_IMAGES - usedSlots);

  // a new cover only needs a free slot when the temple has none. on create there
  // is no gallery yet, so the budget can never be full
  const coverSlotsBlocked = Boolean(editing) && !editing?.coverImage && slotsLeft === 0;

  // the picked file when uploading, otherwise whatever the url field holds. on
  // create an empty box previews nothing rather than a broken frame.
  const coverPreviewUrl = coverPreview || (cover.url.trim() ? cover.url.trim() : "");

  const pickImages = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files);
    const rejected = picked.find(
      (file) =>
        !(TEMPLE_IMAGE_TYPES as readonly string[]).includes(file.type) ||
        file.size > MAX_TEMPLE_IMAGE_BYTES
    );
    if (rejected) {
      setImageError(
        !(TEMPLE_IMAGE_TYPES as readonly string[]).includes(rejected.type)
          ? `${rejected.name} — images must be JPEG, PNG or WebP.`
          : templeImageSizeError(rejected.size)
      );
      setPendingFiles([]);
      return;
    }
    if (picked.length > slotsLeft) {
      setImageError(
        slotsLeft === 0
          ? `A temple can have ${MAX_TEMPLE_IMAGES} images. Remove one before adding another.`
          : `Only ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left — you picked ${picked.length}.`
      );
      setPendingFiles([]);
      return;
    }
    setImageError("");
    setPendingFiles(picked);
  };

  const discardPending = () => {
    setPendingFiles([]);
    setImageError("");
  };

  // validated here rather than after a round trip: the same two rules the bucket
// enforces, so an operator finds out before saving rather than after. the object
// url is only a local preview — nothing is uploaded until the form is saved.
const pickCover = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!(TEMPLE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setCoverError(`${file.name} — images must be JPEG, PNG or WebP.`);
      return;
    }
    if (file.size > MAX_TEMPLE_IMAGE_BYTES) {
      setCoverError(templeImageSizeError(file.size));
      return;
    }
    clearCoverPreview();
    setCover({ mode: "upload", url: "", file });
    setCoverPreview(URL.createObjectURL(file));
    setCoverError("");
  };

  // switching tabs keeps each side's value, so an operator who compares a url
  // against their own file does not lose the paste when they toggle back
  const setCoverMode = (mode: TempleCover["mode"]) => {
    setCover((current) => ({ ...current, mode }));
    setCoverError("");
  };

  const removeImage = (imageId: string) => {
    if (!editing) return;
    startTransition(async () => {
      if (apply(await deleteTempleImageAction(editing.id, imageId), "Image removed.")) {
        setEditing((current) =>
          current
            ? { ...current, images: current.images.filter((i) => i.id !== imageId) }
            : current
        );
      }
    });
  };

  const moveImage = (imageId: string, direction: -1 | 1) => {
    if (!editing) return;
    const ordered = [...editing.images].sort((a, b) => a.sortOrder - b.sortOrder);
    const from = ordered.findIndex((i) => i.id === imageId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= ordered.length) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];

    startTransition(async () => {
      if (apply(await reorderTempleImagesAction(editing.id, ordered.map((i) => i.id)), "Gallery reordered.")) {
        setEditing((current) =>
          current
            ? { ...current, images: ordered.map((i, index) => ({ ...i, sortOrder: index + 1 })) }
            : current
        );
      }
    });
  };

  const approve = (t: Temple) => {
    startTransition(async () => {
      apply(await approveTempleAction(t.id), `${t.name} approved and listed publicly.`);
    });
  };

  const confirmReject = () => {
    if (!pendingReject) return;
    const target = pendingReject;
    setPendingReject(null);
    startTransition(async () => {
      apply(await rejectTempleAction(target.id), `${target.name} not approved and kept off the site.`);
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    startTransition(async () => {
      apply(await deleteTempleAction(target.id), `${target.name} removed.`);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Temples"
        description="Manage the heritage temples shown on the public temples page."
        action={
          <Button size="sm" onClick={openCreate} loading={busy}>
            <Plus className="h-4 w-4" /> Add temple
          </Button>
        }
      />

      <div className="sticky top-16 z-30 -mx-4 mb-2 bg-ivory-50/90 px-4 py-4 backdrop-blur-md sm:top-20 sm:-mx-6 sm:px-6">
        <div className="flex justify-center">
          <SearchInput
            value={query}
            onChange={search}
            placeholder="Search temple, city, deity…"
            className="w-full sm:w-80"
          />
        </div>
      </div>

      <Card
        action={
          <div className="flex items-center gap-2">
            {counts.pending > 0 && <Pill tone="warn">{counts.pending} pending</Pill>}
            {counts.inactive > 0 && <Pill tone="neutral">{counts.inactive} off</Pill>}
          </div>
        }
      >
        {/* below md the nine columns cannot fit a phone, so the same rows stay
            a table but each temple becomes an identity row plus a grid of
            label-over-value pairs: every field is still there and two pairs
            share a row. table-fixed because an auto-layout table measures a
            truncated cell by its full text width, so one long temple name would
            widen the table past the card and push the row actions off the edge.
            fixed layout takes the widths from the colgroup instead, and the
            wrapper catches anything that still exceeds them. the actions column
            is sized for the four 36px buttons plus their gaps. */}
        <div className="overflow-x-auto md:hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col />
              <col className="w-[10rem]" />
            </colgroup>
            {/* no divide-y here: each temple is two rows, so it would draw a
                line between the name and its own detail block. the rule goes
                under the detail row instead, which is exactly where one temple
                ends. */}
            <tbody>
              {paged.map((t) => (
                <Fragment key={t.id}>
                  <Row className={t.isApproved ? undefined : "bg-gold-50/30"}>
                    <Cell className="py-3">{identity(t)}</Cell>
                    <Cell className="py-3">{rowActions(t)}</Cell>
                  </Row>
                  <Row
                    className={cn(
                      "border-b border-charcoal-50 last:border-b-0",
                      !t.isApproved && "bg-gold-50/30"
                    )}
                  >
                    <Cell colSpan={2} className="pb-4">
                      {/* status is left on its own row: seven fields do not split
                          into pairs, and an empty cell beside it would read as a
                          missing value */}
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Deity</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {t.deity || "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">City</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {t.city || "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Images</dt>
                          <dd className="text-sm font-medium text-charcoal-700">
                            {imageCount(t)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Timings</dt>
                          <dd className="text-sm font-medium text-charcoal-700">
                            {timingCount(t)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Contact</dt>
                          <dd className="truncate text-sm font-medium text-charcoal-700">
                            {t.contact || "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Added</dt>
                          <dd className="whitespace-nowrap text-sm font-medium text-charcoal-700">
                            {formatDate(t.addedAt)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-charcoal-400">Status</dt>
                          <dd>{statusPill(t)}</dd>
                        </div>
                      </dl>
                    </Cell>
                  </Row>
                </Fragment>
              ))}
              {visible.length === 0 && (
                <Row>
                  <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={2}>
                    No temples yet.
                  </Cell>
                </Row>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden md:block">
          <Table
            head={["Temple", "Deity", "City", "Images", "Timings", "Contact", "Added", "Status", ""]}
          >
            {paged.map((t) => (
              <Row key={t.id} className={t.isApproved ? undefined : "bg-gold-50/30"}>
                <Cell className="max-w-[240px]">{identity(t)}</Cell>
                <Cell className="text-charcoal-600">{t.deity || "—"}</Cell>
                <Cell className="text-charcoal-600">{t.city || "—"}</Cell>
                <Cell className="text-charcoal-600">{imageCount(t)}</Cell>
                <Cell className="text-charcoal-600">{timingCount(t)}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-600">{t.contact || "—"}</Cell>
                <Cell className="whitespace-nowrap text-charcoal-400">
                  {formatDate(t.addedAt)}
                </Cell>
                <Cell>{statusPill(t)}</Cell>
                <Cell>{rowActions(t)}</Cell>
              </Row>
            ))}
            {visible.length === 0 && (
              <Row>
                <Cell className="py-8 text-center text-sm text-charcoal-400" colSpan={9}>
                  No temples yet.
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
        size="xl"
        dismissOnBackdrop={false}
        title={editing ? `Edit ${editing.name}` : "Add new temple"}
        description={
          editing
            ? "Update the details shown on the public temples page."
            : "New temples are published to the public temples page immediately."
        }
      >
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Identity
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
<Input
                label="Temple name"
                placeholder="e.g. Palani Murugan Temple"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                error={errors.name}
                data-field="name"
              />
              <Input
                label="Name in Tamil"
                placeholder="பழனி முருகன் கோவில்"
                value={form.nameTa}
                onChange={(e) => set("nameTa")(e.target.value)}
                error={errors.nameTa}
                data-field="nameTa"
              />
              <Input
                label="Deity"
                placeholder="e.g. Murugan (Kartikeya)"
                value={form.deity}
                onChange={(e) => set("deity")(e.target.value)}
              />
            </div>
          </section>

          {/* the cover is its own section rather than a fourth box in the grid,
              because it carries a dropdown, a live preview and a file picker and
              would otherwise stretch the identity row out of shape */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Cover image
            </h3>
            <p className="text-sm text-charcoal-600">
              Landscape works best — roughly 3:2, such as 1500&times;1000. Shown as the wide banner
              at the top of the temple page, so a portrait photo gets cropped at the sides.
            </p>

            <div className="max-w-xs">
              <Select
                label="Cover image from"
                value={cover.mode}
                onChange={(e) => setCoverMode(e.target.value as TempleCover["mode"])}
              >
                <option value="url">Image URL</option>
                <option value="upload">Image upload</option>
              </Select>
            </div>

            {/* one field at a time rather than both: the two are alternative
                sources for the same single value, and showing both invites the
                question of which one wins */}
            {cover.mode === "url" ? (
              <Input
                label="Cover image URL"
                placeholder="https://…"
                value={cover.url}
                onChange={(e) => {
                  setCover((c) => ({ ...c, url: e.target.value }));
                  setCoverError("");
                }}
                hint={
                  editing?.coverImage
                    ? "Leave empty and save to remove the current cover."
                    : "Paste a link to an image you already host."
                }
                error={coverError || undefined}
              />
            ) : (
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-charcoal-800">Choose a file</span>
                <input
                  type="file"
                  accept={TEMPLE_IMAGE_ACCEPT}
                  disabled={busy || coverSlotsBlocked}
                  onChange={(e) => pickCover(e.target.files)}
                  className="block w-full text-sm text-charcoal-600 file:mr-3 file:rounded-xl file:border-0 file:bg-wine-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-wine-700 hover:file:bg-wine-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-charcoal-400">
                  JPEG, PNG or WebP, up to {formatBytes(MAX_TEMPLE_IMAGE_BYTES)}. Uses one of the{" "}
                  {MAX_TEMPLE_IMAGES} image slots — the rest are for the gallery.
                </p>
                {coverSlotsBlocked && (
                  <p className="text-xs font-medium text-wine-600">
                    All {MAX_TEMPLE_IMAGES} image slots are used by the gallery. Remove one to add a
                    cover.
                  </p>
                )}
              </div>
            )}

            {coverPreviewUrl && (
              <div className="flex flex-wrap items-center gap-3">
                {/* a plain img, not next/image: the source is either a blob the
                    operator just picked or a url nobody registered, so there is
                    nothing for the loader to optimize */}
                <img
                  src={coverPreviewUrl}
                  alt={`${form.name || "Temple"} cover preview`}
                  className="h-40 w-full max-w-sm rounded-xl border border-charcoal-200 bg-charcoal-50 object-cover"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // clear the value for whichever source is showing, and only
                    // revoke when that source is a blob we made. revoking a
                    // pasted https url is a no-op at best and misleading.
                    clearCoverPreview();
                    setCover((c) =>
                      c.mode === "upload" ? { ...c, file: null } : { ...c, url: "" }
                    );
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Location
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Address"
                placeholder="e.g. Arulmigu Dhandayuthapaniswamy Temple, Giri Veethi"
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                error={errors.address}
                data-field="address"
                className="sm:col-span-2"
              />
              <Input
                label="City"
                placeholder="e.g. Palani"
                value={form.city}
                onChange={(e) => set("city")(e.target.value)}
                error={errors.city}
                data-field="city"
              />
              <Input
                label="District"
                placeholder="e.g. Dindigul"
                value={form.district}
                onChange={(e) => set("district")(e.target.value)}
                error={errors.district}
                data-field="district"
              />
              <Input
                label="State"
                placeholder="e.g. Tamil Nadu"
                value={form.state}
                onChange={(e) => set("state")(e.target.value)}
              />
              <Input
                label="Country"
                placeholder="India"
                value={form.country}
                onChange={(e) => set("country")(e.target.value)}
              />
              {/* a url, not lat/lng: those two columns were dropped because
                  nothing read them. open the temple in Google Maps, hit Share, and
                  paste whatever it gives — a long google.com/maps link or a short
                  maps.app.goo.gl one both work. */}
              <Input
                label="Google Maps link"
                type="url"
                placeholder="https://maps.app.goo.gl/…"
                value={form.mapsUrl}
                onChange={(e) => set("mapsUrl")(e.target.value)}
                error={errors.mapsUrl}
                data-field="mapsUrl"
                className="sm:col-span-2"
                hint="Optional. Drives the Get Directions button on the temple page. If left blank, the button searches the address instead."
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Contact
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                placeholder="e.g. 0452-234 4360"
                value={form.contact}
                onChange={(e) => set("contact")(e.target.value)}
                error={errors.contact}
                data-field="contact"
              />
              <Input
                label="WhatsApp"
                type="tel"
                required
                placeholder="e.g. 8883943711"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp")(e.target.value)}
                error={errors.whatsapp}
                data-field="whatsapp"
              />
              <Input
                label="Email"
                type="email"
                placeholder="e.g. office@temple.example"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                error={errors.email}
                data-field="email"
              />
              <Input
                label="Contact person"
                placeholder="e.g. Temple office manager"
                value={form.contactPerson}
                onChange={(e) => set("contactPerson")(e.target.value)}
                error={errors.contactPerson}
                data-field="contactPerson"
              />
              <Input
                label="Website"
                type="url"
                placeholder="https://…"
                value={form.website}
                onChange={(e) => set("website")(e.target.value)}
                error={errors.website}
                data-field="website"
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Visitor information
            </h3>
            {/* one box per weekday, because a single timings string cannot say
                which day a visitor is asking about. Sunday first. */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-charcoal-800">Opening hours</p>
                <p className="text-xs text-charcoal-400">
                  Leave a day blank to hide it. Write &ldquo;Closed&rdquo; to say
                  the temple is shut.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLE_DAYS.map((day, index) => (
                  <Input
                    key={day}
                    label={day}
                    placeholder={
                      day === "Sunday" || day === "Saturday"
                        ? "e.g. 5:00 AM - 12:30 PM, 4:00 PM - 10:00 PM"
                        : "e.g. 5:00 AM - 12:30 PM"
                    }
                    value={form.timings[index] ?? ""}
                    onChange={(e) => setTiming(index, e.target.value)}
                  />
                ))}
              </div>
            </div>
            <Textarea
              label="History / details"
              placeholder="A short note about the temple — its history, who built it, and anything a visitor should know."
              value={form.history}
              onChange={(e) => set("history")(e.target.value)}
              error={errors.history}
              data-field="history"
            />
          </section>

          {/* festivals are available on create too, unlike the gallery. the rows
              are held in local state and written by saveTempleFestivalsAction
              after the temple row exists, so the foreign key is never a problem —
              the admin does not have to save twice to add one. */}
          <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
                Upcoming festivals
              </h3>
              <p className="text-sm text-charcoal-600">
                Listed on the temple page with the soonest first. Dates that have
                passed stop showing automatically, so add each season&rsquo;s dates
                afresh.
              </p>

              {festivals.length === 0 ? (
                <p className="text-sm text-charcoal-500">
                  No festivals added yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {festivals.map((festival, index) => (
                    <li
                      key={index}
                      className="grid gap-3 rounded-xl border border-charcoal-200 bg-charcoal-50/60 p-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end"
                    >
                      <Input
                        label="Festival name"
                        placeholder="e.g. Chithirai Thiruvizha"
                        value={festival.name}
                        onChange={(e) => updateFestival(index, { name: e.target.value })}
                        error={errors[`festival-${index}`]}
                        data-field={`festival-${index}`}
                      />
                      <Input
                        label="Date"
                        type="date"
                        value={festival.happensOn}
                        onChange={(e) => updateFestival(index, { happensOn: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeFestival(index)}
                        className="justify-self-start rounded-lg px-2.5 py-2 text-sm font-medium text-charcoal-500 transition-colors hover:bg-wine-50 hover:text-wine-700 sm:justify-self-end"
                        aria-label={`Remove ${festival.name || "festival"}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={addFestival}
                className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-200 px-3 py-2 text-sm font-medium text-charcoal-700 transition-colors hover:border-gold-300 hover:bg-gold-50"
              >
                <Plus className="h-4 w-4" /> Add festival
              </button>
            </section>

          {/* packages, also on create. held in local state and written by
              saveTempleServicesAction after the temple row exists, for the same
              reason as the festivals. the row is updated in place rather than
              replaced, so terms, the image and a package an admin has switched off
              all survive an edit that only touched the name and price. */}
          <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
                Services &amp; pricing
              </h3>
              <p className="text-sm text-charcoal-600">
                Listed on the temple page in this order. A price of 0 shows as
                &ldquo;On request&rdquo;, which is how a package that is free to
                ask about stays distinct from one that genuinely costs nothing.
              </p>

              {services.length === 0 ? (
                <p className="text-sm text-charcoal-500">
                  No services added yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {services.map((service, index) => (
                    <li
                      key={index}
                      className="grid gap-3 rounded-xl border border-charcoal-200 bg-charcoal-50/60 p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start"
                    >
                      <div className="space-y-3">
                        <Input
                          label="Service name"
                          placeholder="e.g. Special pooja"
                          value={service.name}
                          onChange={(e) => updateService(index, { name: e.target.value })}
                          error={errors[`service-${index}`]}
                          data-field={`service-${index}`}
                        />
                        <Input
                          label="Details"
                          placeholder="What is included, how long it takes, anything a visitor should know."
                          value={service.details}
                          onChange={(e) => updateService(index, { details: e.target.value })}
                        />
                      </div>
                      <Input
                        label="Price (₹)"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={service.price}
                        onChange={(e) => updateService(index, { price: e.target.value })}
                        hint="Whole rupees. 0 means On request."
                      />
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="justify-self-start rounded-lg px-2.5 py-2 text-sm font-medium text-charcoal-500 transition-colors hover:bg-wine-50 hover:text-wine-700 sm:justify-self-end"
                        aria-label={`Remove ${service.name || "service"}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={addService}
                className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-200 px-3 py-2 text-sm font-medium text-charcoal-700 transition-colors hover:border-gold-300 hover:bg-gold-50"
              >
                <Plus className="h-4 w-4" /> Add service
              </button>
            </section>

          {/* the gallery is on create as well. the files are staged in
              pendingFiles and uploaded by submit() once the temple row exists and
              therefore has a folder, so the upload is not blocked by the foreign
              key — the admin still only saves once. */}
          <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
              Gallery
            </h3>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-charcoal-600">
                {usedSlots} of {MAX_TEMPLE_IMAGES} used
                {coverCounted > 0 && " (including the cover)"}
                {slotsLeft === 0 && " — remove one to add another"}
              </p>
              <p className="text-xs text-charcoal-400">
                JPEG, PNG or WebP, up to {formatBytes(MAX_TEMPLE_IMAGE_BYTES)} each
              </p>
            </div>

            {/* only when editing: the saved rows are what this list shows, and a
                temple that does not exist yet has none. the picker below is shown
                either way. */}
            {editing && editing.images.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[...editing.images]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((image, index, all) => (
                      <li
                        key={image.id}
                        className="group relative overflow-hidden rounded-xl border border-charcoal-200 bg-charcoal-50"
                      >
                        {/* a plain img rather than next/image: these are
                            operator-uploaded urls of unknown dimensions, and
                            next/image would need every one registered */}
                        <img
                          src={image.url}
                          alt={image.alt || `${editing?.name || form.name || "Temple"} gallery image ${index + 1}`}
                          className="h-28 w-full object-cover"
                        />
                        <div className="flex items-center justify-between gap-1 border-t border-charcoal-200 bg-white px-2 py-1.5">
                          <span className="text-xs text-charcoal-400">#{index + 1}</span>
                          <div className="flex items-center gap-0.5">
                            <IconAction
                              label={`Move ${image.alt || `image ${index + 1}`} earlier`}
                              onClick={() => moveImage(image.id, -1)}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </IconAction>
                            <IconAction
                              label={`Move ${image.alt || `image ${index + 1}`} later`}
                              onClick={() => moveImage(image.id, 1)}
                              disabled={index === all.length - 1}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </IconAction>
                            <IconAction
                              label={`Remove ${image.alt || `image ${index + 1}`}`}
                              tone="bad"
                              onClick={() => removeImage(image.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconAction>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}

<input
              type="file"
              accept={TEMPLE_IMAGE_ACCEPT}
              multiple
              disabled={slotsLeft === 0}
              // the input keeps its FileList after a change, so re-picking the
              // same file would not fire onChange again and the operator would
              // see nothing happen. clearing the value is what makes a retry work.
              onChange={(e) => {
                pickImages(e.target.files);
                e.target.value = "";
              }}
              className="block w-full text-sm text-charcoal-600 file:mr-3 file:rounded-xl file:border-0 file:bg-wine-50 file:px-4 file:py-2.5 file:text-sm file:font-medium text-wine-700 hover:file:bg-wine-100 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {imageError && (
              <p className="text-xs font-medium text-wine-600">{imageError}</p>
            )}

            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-charcoal-200 bg-charcoal-50 px-3 py-2.5">
                <span className="text-sm text-charcoal-700">
                  {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready
                </span>
                <span className="text-xs text-charcoal-400">
                  {pendingFiles.map((f) => formatBytes(f.size)).join(", ")}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={discardPending}>
                    Discard
                  </Button>
                </div>
              </div>
            )}

            {editing && editing.images.length === 0 && pendingFiles.length === 0 && !imageError && (
              <p className="text-xs text-charcoal-400">
                No images yet. The listing still works without them.
              </p>
            )}

            {pendingFiles.length === 0 && (
              <p className="text-xs text-charcoal-400">
                Optional. {editing ? "" : "Files are "}uploaded when you save the
                temple.
              </p>
            )}
          </section>

          <div className="flex flex-col-reverse gap-2 border-t border-charcoal-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeModal} className="w-full sm:w-auto">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" loading={busy} className="w-full sm:w-auto">
              <Check className="h-4 w-4" /> {editing ? "Save changes" : "Add temple"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove temple?"
        confirmLabel="Remove temple"
        description={
          <>
            <strong>{pendingDelete?.name}</strong> will be removed from the temple list. Use
            &ldquo;Hide&rdquo; instead if you only want to pause it.
          </>
        }
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />

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
