"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  CookingPot,
  MapPin,
  Navigation,
  Phone,
  SlidersHorizontal,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FilterTabs } from "@/components/admin/shared";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_TYPES,
  SERVICE_TYPE_LABELS,
  categoryOf,
  type ServiceCategory,
  type ServiceProvider,
} from "@/features/services/types";
import { cn } from "@/lib/utils";

const CATEGORY_TONES: Record<ServiceCategory, { chip: string; ring: string; rail: string }> = {
  mandapam: {
    chip: "bg-wine-50 text-wine-700",
    ring: "border-wine-200",
    rail: "from-wine-300 to-wine-100",
  },
  catering: {
    chip: "bg-gold-50 text-gold-800",
    ring: "border-gold-200",
    rail: "from-gold-300 to-gold-100",
  },
  wedding: {
    chip: "bg-charcoal-100 text-charcoal-700",
    ring: "border-charcoal-200",
    rail: "from-charcoal-300 to-charcoal-100",
  },
};

const CATEGORY_ICONS: Record<ServiceCategory, LucideIcon> = {
  mandapam: Building2,
  catering: CookingPot,
  wedding: Sparkles,
};

/** one call-button colour for every category: the ivory page must not end up
    with a gold or black slab on some groups and wine on others */
const CTA_BUTTON = "bg-wine-700 hover:bg-wine-800";

type Filter = ServiceCategory | "all";

export function ServicesDirectory({ services }: { services: ServiceProvider[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  // counts come from the published list, so a tab can never advertise a vendor
  // that the filter below would then hide
  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: services.length };
    for (const service of services) {
      const key = categoryOf(service.type);
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [services]);

  const options = useMemo(
    () => [
      { key: "all" as const, label: "All services", count: counts.all ?? 0 },
      ...(Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[])
        .filter((key) => (counts[key] ?? 0) > 0)
        .map((key) => ({ key, label: SERVICE_CATEGORY_LABELS[key], count: counts[key] ?? 0 })),
    ],
    [counts]
  );

  // grouped in the order SERVICE_CATEGORY_TYPES declares, so the page order is
  // fixed by the data and not by whichever vendor happens to sort first
  const groups = useMemo(() => {
    const visible =
      filter === "all" ? services : services.filter((s) => categoryOf(s.type) === filter);
    return (Object.keys(SERVICE_CATEGORY_LABELS) as ServiceCategory[])
      .map((category) => ({
        category,
        label: SERVICE_CATEGORY_LABELS[category],
        items: visible.filter((s) => SERVICE_CATEGORY_TYPES[category].includes(s.type)),
      }))
      .filter((group) => group.items.length > 0);
  }, [services, filter]);

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="No services listed yet"
        description="Vendors added from the admin area appear here automatically."
      />
    );
  }

  const activeOption = options.find((option) => option.key === filter);
  const visibleCount = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <div>
      {/* the filter stays reachable while a member scrolls a long list, and
          clears the sticky site header (h-16, h-20 from sm up) */}
      <div className="sticky top-16 z-30 -mx-4 mb-10 bg-ivory-50/90 px-4 py-4 backdrop-blur-md sm:top-20 sm:-mx-6 sm:px-6">
        {/* four labelled pills only fit on one row from lg up; below that they
            wrap into a tall block that eats a phone screen, so mobile gets one
            trigger instead and the same list opens as a sheet */}
        <div className="hidden justify-center lg:flex">
          <FilterTabs value={filter} onChange={setFilter} options={options} />
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="min-w-0 text-sm text-charcoal-600">
            <span className="font-semibold text-charcoal-900">{activeOption?.label}</span>
            <span className="text-charcoal-400"> · {visibleCount} listed</span>
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

      {/* the sheet is a bottom sheet on a phone (see ui/modal) and one tap on a
          row both filters the list and closes it, which is what a phone list
          of five options should do */}
      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter services"
        size="sm"
      >
        <ul className="space-y-2">
          {options.map((option) => {
            const OptionIcon = option.key === "all" ? Store : CATEGORY_ICONS[option.key];
            const isActive = option.key === filter;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  onClick={() => {
                    setFilter(option.key);
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
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        isActive ? "bg-white/20 text-white" : "bg-charcoal-100 text-charcoal-500"
                      )}
                    >
                      {option.count}
                    </span>
                    {isActive && <Check className="h-4 w-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <div className="space-y-14">
        {groups.map((group) => {
          const tone = CATEGORY_TONES[group.category];
          const GroupIcon = CATEGORY_ICONS[group.category];
          return (
            <section key={group.category} id={group.category} className="scroll-mt-40">
              <div className="mb-5 flex items-center gap-3.5">
                <span
                  className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone.chip)}
                >
                  <GroupIcon className="h-5 w-5" />
                </span>
                <h2 className="font-display text-2xl font-semibold text-charcoal-900 sm:text-3xl">
                  {group.label}
                </h2>
                <span className="rounded-full bg-wine-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {group.items.length}
                </span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((service) => {
                  const tel = `tel:${service.phone.replace(/\s+/g, "")}`;
                  return (
                    <article
                      key={service.id}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-3xl border bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover",
                        tone.ring
                      )}
                    >
                      {/* the rail brightens on hover, so the card feels alive
                          rather than only lifting */}
                      <div
                        aria-hidden
                        className={cn(
                          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-70 transition-opacity duration-300 group-hover:opacity-100",
                          tone.rail
                        )}
                      />

                      <div className="p-6 pb-5">
                        <div className="mb-4 flex items-center gap-3">
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                              tone.chip
                            )}
                          >
                            {SERVICE_TYPE_LABELS[service.type]}
                          </span>
                        </div>

                        <h3 className="font-display text-lg font-semibold leading-snug text-charcoal-900">
                          {service.name}
                        </h3>

                        <dl className="mt-4 space-y-2.5 text-sm">
                          <div className="flex items-center gap-2.5">
                            <dt className="sr-only">Contact person</dt>
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                tone.chip
                              )}
                            >
                              <User className="h-3.5 w-3.5" />
                            </span>
                            <dd className="truncate font-medium text-charcoal-800">
                              {service.contact}
                            </dd>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <dt className="sr-only">City</dt>
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                tone.chip
                              )}
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </span>
                            <dd className="truncate text-charcoal-600">{service.city}</dd>
                          </div>
                          {/* the street, under the city. a mandapam is somewhere a
                              family has to drive to, so the city on its own is not
                              enough to plan the visit */}
                          {service.address && (
                            <div className="flex items-start gap-2.5">
                              <dt className="sr-only">Address</dt>
                              <span
                                className={cn(
                                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                  tone.chip
                                )}
                              >
                                <Navigation className="h-3.5 w-3.5" />
                              </span>
                              <dd className="min-w-0 text-charcoal-600">{service.address}</dd>
                            </div>
                          )}
                        </dl>

                        {/* the full description is shown, not a preview: the
                            admin writes it for the member to read before calling */}
                        {service.details && (
                          <p className="mt-4 rounded-2xl border border-charcoal-100 bg-charcoal-50/80 p-4 text-sm leading-relaxed text-charcoal-600">
                            {service.details}
                          </p>
                        )}
                      </div>

                      {/* pinned to the bottom so every card in the grid ends at
                          the same height and the buttons line up */}
                      <div className="mt-auto border-t border-charcoal-100 p-4">
                        <a
                          href={tel}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors",
                            CTA_BUTTON
                          )}
                        >
                          <Phone className="h-4 w-4" />
                          <span className="truncate">{service.phone}</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
