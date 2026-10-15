import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarHeart,
  Clock,
  Globe,
  Images,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { fetchTempleById } from "@/lib/data/queries";
import { TempleGallery } from "@/components/temples/temple-gallery";
import { Rule } from "@/components/ui/hero-plate";
import { cn } from "@/lib/utils";
import { isHttpUrl, type Temple } from "@/features/temples/types";
import { pageSeo } from "@/lib/seo";

// The shared CONTAINER stops at max-w-7xl, which leaves the map, the photo grid
// and the timings table narrower than they need to be on a desktop. This is the
// only page that carries all three, so the wider cap is applied here rather than
// loosening every page on the site.
const WIDE = "mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8";

// the temple, its services, gallery and festivals are read from the database.
// revalidate, not force-dynamic: the page is the same for every visitor, so it
// is cached and refreshed in the background instead of rebuilt with a database
// round trip on each request. admin saves call revalidateTag("public-data"), so
// an edit still appears at once rather than waiting out the window.
export const revalidate = 300;

// "2026-04-14" as "14 Apr 2026". built by hand rather than through toLocaleDateString
// because the server locale decides the output, so the same page can render two
// different date formats depending on which pod answers it. festival dates are
// public and unambiguous, so they are formatted the same way everywhere.
function formatFestivalDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const monthName = months[Number(month) - 1];
  if (!monthName) return iso;
  return `${Number(day)} ${monthName} ${year}`;
}

// Joins address parts and drops the repeats. city and district are often the
// same word ("Tuticorin, Tuticorin"), and a visitor reading that twice thinks
// the record is wrong rather than that the form has two boxes for one place.
function joinParts(parts: string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(value);
  }
  return kept.join(", ");
}

function telHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}

// wa.me needs the number in international form: digits only, no +, no spaces.
// Most temples type the ten digit local number, so 91 is added when it is
// missing rather than handing WhatsApp a link it cannot resolve.
function whatsappHref(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
}

// Every Enquire button on the page lands here. The question is written into the
// chat so the temple office is not left staring at an empty box, and a temple
// with no WhatsApp number still gets a working button on its phone line rather
// than a dead one. Empty only when the admin filled in neither channel.
function enquireHref(temple: Temple, message: string): string {
  const wa = whatsappHref(temple.whatsapp);
  if (wa) return `${wa}?text=${encodeURIComponent(message)}`;
  return temple.contact ? telHref(temple.contact) : "";
}

// Opens every enquiry with the temple and the person who answers it, so the
// message reads as addressed to someone rather than fired at a saved number:
// "Hello Sri Meenakshi Amman Temple (Karthik, temple office),". the name is left
// out when the admin has not filled the field rather than shown as empty brackets.
function enquiryGreeting(temple: Temple): string {
  return temple.contactPerson
    ? `Hello ${temple.name} (${temple.contactPerson}),`
    : `Hello ${temple.name},`;
}

// The admin form only checks that an email contains an "@", so the shape is
// confirmed here before the value is trusted as an href.
function mailtoHref(value: string): string {
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return `mailto:${trimmed}`;
}

// "www.example.com" rather than the whole url: a pasted link often carries a
// tracking query and a deep path, neither of which belongs on a button label.
function websiteLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

// The embedded map. Built as a text search of the address rather than from the
// pasted pin: mapsUrl is often a maps.app.goo.gl short link, which keeps the
// coordinates in a redirect this page cannot follow, and the Embed API wants a
// key the site does not carry. A query embed needs neither and still centres on
// the temple.
function mapEmbedHref(temple: Temple): string {
  const query = joinParts([
    temple.name,
    temple.address,
    temple.city,
    temple.district,
    temple.state,
    temple.country,
  ]);
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

// One card shell for every block on the page. Each section used to carry its own
// copy of the border, radius and padding, which is how the spacing drifted out of
// line with itself as blocks were added. bodyClassName is the escape hatch for
// the map, whose iframe has to sit flush against the card edge.
function Panel({
  icon: Icon,
  title,
  bodyClassName,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-gold-200 bg-white shadow-card",
        // min-w-0 lets the card shrink inside a grid or flex parent. without it a
        // card's intrinsic width is its longest word, and on a phone one long
        // word in a heading is enough to push the card past the screen edge.
        "min-w-0",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-6 pt-6 sm:px-8 sm:pt-8">
        <Icon className="h-5 w-5 shrink-0 text-gold-700" />
        <h2 className="min-w-0 break-words font-display text-xl font-semibold text-charcoal-900">
          {title}
        </h2>
      </div>
      <div className={cn("min-w-0 break-words px-6 pb-6 pt-5 sm:px-8 sm:pb-8", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ temple_id: string }>;
}): Promise<Metadata> {
  const { temple_id } = await params;
  const temple = await fetchTempleById(temple_id);
  if (!temple)
    return { title: "Temple not found — Subha Vivaham Matrimony", robots: { index: false } };
  // the cover is the one image a temple reliably has. shared without it, the
  // link shows up as a bare title card in WhatsApp and every other chat app,
  // which is where most of these links are actually opened. checked as a url
  // because the admin can type one in by hand.
  return pageSeo({
    title: `${temple.name} — Temples | Subha Vivaham Matrimony`,
    description:
      temple.deity ||
      `Timings, location and services at ${temple.name}, maintained by our own team.`,
    path: `/temples/${temple.id}`,
    image: isHttpUrl(temple.coverImage) ? temple.coverImage : undefined,
  });
}

export default async function TempleDetailPage({
  params,
}: {
  params: Promise<{ temple_id: string }>;
}) {
  const { temple_id } = await params;
  const temple = await fetchTempleById(temple_id);
  if (!temple) notFound();

  const place = joinParts([temple.city, temple.state, temple.country]);

  // the street address on its own line, then the locality and the region under
  // it, each deduplicated: the admin form has a box for city and another for
  // district and they are very often the same word.
  const address = [
    temple.address.trim(),
    joinParts([temple.city, temple.district]),
    joinParts([temple.state, temple.country]),
  ].filter(Boolean);

  // days the admin filled in, in week order. a blank day is dropped rather than
  // rendered as an empty line, so the aside lists only what is actually known.
  const openDays = temple.timings.filter((timing) => timing.hours);

  // only absolute urls reach an <Image src>. a value typed into the admin box
  // by hand is not guaranteed to be one, and an image that silently fails to
  // load is worse than no hero at all.
  const cover = isHttpUrl(temple.coverImage)
    ? temple.coverImage
    : temple.images.find((image) => isHttpUrl(image.url))?.url ?? "";
  const gallery = temple.images.filter((image) => isHttpUrl(image.url));

  const whatsapp = whatsappHref(temple.whatsapp);
  const email = mailtoHref(temple.email);
  const website = isHttpUrl(temple.website) ? temple.website : "";
  const mapSrc = mapEmbedHref(temple);
  const hasContact =
    Boolean(temple.contactPerson) ||
    Boolean(temple.contact) ||
    Boolean(whatsapp) ||
    Boolean(email) ||
    Boolean(website);

  return (
    // overflow-x-clip on the page root: a single card with an unbreakable value
    // in it (a long email, a pasted url) used to be enough to give the whole page
    // a horizontal scrollbar on a phone, which then let every card be dragged
    // sideways. the cards below are all built to wrap, and this is the backstop
    // for the one that is not.
    <div className="overflow-x-clip bg-gradient-to-b from-ivory-50 via-white to-ivory-50/60 pb-20">
      {/* ------------------------------------------------------------- hero */}
      {/* the plate only grows taller when there is a cover to show, so the photo
          is a real band across the top rather than a sliver behind the title */}
      <section
        className={`relative isolate flex items-center overflow-hidden bg-gradient-to-b from-wine-950 to-wine-900 text-center ${
          cover ? "min-h-[26rem] py-16 sm:min-h-[32rem] sm:py-24" : "py-14 sm:py-16"
        }`}
      >
        {/* the cover is the hero, so it is not dimmed: the wine ground only shows
            through as a light brand tint. unoptimized because the cover can be any
            url an admin pasted, and the optimizer refuses a host that is not in
            remotePatterns — which would take the whole page down rather than just
            the picture */}
        {cover && (
          <>
            <Image
              src={cover}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="absolute inset-0 -z-10 object-cover"
            />
            {/* a flat tint for the brand, then a vignette that is darkest exactly
                where the type sits. both are kept light: the corners of the
                photo are what make this read as a temple rather than a brown
                panel, so the shade only has to carry the type */}
            <span aria-hidden className="absolute inset-0 -z-10 bg-wine-950/20" />
            <span
              aria-hidden
              className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(24,7,16,0.6)_0%,rgba(24,7,16,0.4)_38%,rgba(24,7,16,0.14)_72%,rgba(24,7,16,0)_100%)]"
            />
          </>
        )}

        {/* no panel behind the text: the wash above carries the contrast, and a
            box here would cut the photograph into a letterbox. the shadow on the
            type is what keeps the name readable over a bright gopuram. */}
        <div className={WIDE}>
          <div className="mx-auto max-w-3xl [text-shadow:0_2px_12px_rgba(12,3,10,0.5)]">
            <Link
              href="/temples"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75 transition-colors hover:text-gold-300"
            >
              <ArrowLeft className="h-4 w-4" /> All temples
            </Link>

            <h1 className="mx-auto mt-6 max-w-3xl break-words font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {temple.name}
            </h1>

            {temple.deity && (
              <p className="mt-3 break-words font-display text-lg text-gold-300">{temple.deity}</p>
            )}

            {/* lang="ta" so a screen reader switches voice rather than reading the
                Tamil name with the English one. the tamil script is the name the
                family will recognise, so it sits directly under the latin one */}
            {temple.nameTa && (
              <p lang="ta" className="mt-2 break-words font-display text-lg text-white/85">
                {temple.nameTa}
              </p>
            )}

            {(place || temple.deity) && (
              <div className="mx-auto mt-7 max-w-xs">
                <Rule />
              </div>
            )}

            {place && (
              <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-wine-950/45 px-3.5 py-1.5 text-sm font-medium text-white/90">
                <MapPin className="h-3.5 w-3.5 text-gold-300" />
                {place}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* the two columns answer two different questions: the wide one tells the
          story of the temple, the narrow one is what a visitor needs on the day
          — where to go, when it is open, who to call. */}
      <div className={`${WIDE} mt-10`}>
        {/* min-w-0 on both children, not just on Panel. a grid item defaults to
            min-width:auto, which means it may never be narrower than its own
            min-content width, so one long unbreakable string anywhere inside was
            enough to hold the whole column at 393px on a 360px phone. min-w-0 on
            Panel alone did nothing: the element being sized is this div, one level
            further out. */}
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-8">
          {/* ------------------------------------------------------ details */}
          <div className="min-w-0 space-y-6">
            <Panel icon={BookOpen} title="About this temple">
              {temple.history ? (
                <p className="text-sm leading-relaxed break-words text-charcoal-600 sm:text-base">
                  {temple.history}
                </p>
              ) : (
                <p className="text-sm text-charcoal-500">
                  We have not written the history of this temple yet.
                </p>
              )}
            </Panel>

            {/* ------------------------------------------------------ gallery */}
            {/* straight under the history: a visitor decides whether this is the
                temple they are looking for from the story and the pictures, long
                before they care about timings or prices */}
            {gallery.length > 0 && (
              <Panel icon={Images} title="Photos">
                <TempleGallery images={gallery} name={temple.name} />
              </Panel>
            )}
          </div>

          {/* --------------------------------------------------------- aside */}
          {/* the aside is not sticky: seven days of timings plus every contact
              channel is taller than a laptop viewport, and a pinned column
              taller than the screen puts its own last rows out of reach */}
          <aside className="min-w-0 space-y-4">
            <Panel icon={Landmark} title="Plan your visit" className="border-charcoal-100">
              
              {/* only days the admin filled in. an unset day is hidden rather than
                  shown blank, which would read as "closed" — a different claim. */}
              {openDays.length > 0 && (
                <div className={cn("flex items-start gap-3", address.length > 0 && "mt-5")}>
                  {/* <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-800">
                    <Clock className="mt-0.5 h-4 w-4" />
                  </span> */}
                  <dl className="min-w-0 flex-1 divide-y divide-charcoal-100">
                    {openDays.map((timing) => (
                      <div
                        key={timing.day}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0"
                      >
                        <dt className="shrink-0 text-sm font-medium text-charcoal-700">
                          {timing.day}
                        </dt>
                        {/* break-words on the hours: a temple that opens three times
                            writes a 40 character string, and on a 360px phone that
                            has to wrap inside the column rather than widen the card */}
                        <dd className="min-w-0 break-words text-right text-sm tabular-nums text-charcoal-600">
                          {timing.hours}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </Panel>

            {/* -------------------------------------------------------- contact */}
            {hasContact && (
              <Panel icon={Phone} title="Contact" className="border-charcoal-100">
                {temple.contactPerson && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-gold-800">
                      <UserRound className="mt-0.5 h-4 w-4" />
                    </span>
                    <p className="min-w-0 leading-relaxed">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-500">
                        Contact person
                      </span>
                      <span className="mt-0.5 block text-charcoal-800">
                        {temple.contactPerson}
                      </span>
                    </p>
                  </div>
                )}

                {/* the channels the temple office actually answers on. each one is
                    only rendered when the value survives its own check, so a
                    half-typed email or a website without a protocol cannot leave
                    a dead button behind */}
                {(whatsapp || email || website) && (
                  <div className={cn("space-y-2", temple.contactPerson && "mt-5")}>
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2.5 rounded-xl border border-charcoal-200 px-3.5 py-2.5 text-sm transition-colors hover:border-gold-300 hover:bg-gold-50"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0 text-gold-700" />
                        <span className="shrink-0 font-medium text-charcoal-700">
                          WhatsApp
                        </span>
                        <span className="ml-auto min-w-0 truncate text-charcoal-500">
                          {temple.whatsapp}
                        </span>
                      </a>
                    )}
                    {email && (
                      <a
                        href={email}
                        className="flex min-w-0 items-center gap-2.5 rounded-xl border border-charcoal-200 px-3.5 py-2.5 text-sm transition-colors hover:border-gold-300 hover:bg-gold-50"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-gold-700" />
                        <span className="shrink-0 font-medium text-charcoal-700">
                          Email
                        </span>
                        <span className="ml-auto min-w-0 truncate text-charcoal-500">
                          {temple.email}
                        </span>
                      </a>
                    )}
                    {website && (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2.5 rounded-xl border border-charcoal-200 px-3.5 py-2.5 text-sm transition-colors hover:border-gold-300 hover:bg-gold-50"
                      >
                        <Globe className="h-4 w-4 shrink-0 text-gold-700" />
                        <span className="shrink-0 font-medium text-charcoal-700">
                          Website
                        </span>
                        <span className="ml-auto min-w-0 truncate text-charcoal-500">
                          {websiteLabel(website)}
                        </span>
                      </a>
                    )}
                  </div>
                )}

                {temple.contact && (
                  <a
                    href={telHref(temple.contact)}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-xl bg-wine-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-wine-900",
                      (whatsapp || email || website || temple.contactPerson) && "mt-5"
                    )}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="truncate">{temple.contact}</span>
                  </a>
                )}
              </Panel>
            )}
          </aside>
        </div>
      </div>

      {/* --------------------------------------------------- festivals - full width */}
      {temple.festivals.length > 0 && (
        <div className={`${WIDE} mt-10`}>
          <div className="flex items-center gap-2.5 mb-6">
            <CalendarHeart className="h-5 w-5 shrink-0 text-gold-700" />
            <h2 className="font-display text-xl font-semibold text-charcoal-900">Upcoming festivals</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {temple.festivals.map((festival) => (
              <div
                key={festival.id || festival.name}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-charcoal-100 bg-gradient-to-br from-ivory-50 to-white p-4 transition-all hover:border-gold-200 hover:shadow-md"
              >
                {/* break-words on the name: festival names run long, and one of
                    them without a break is what used to widen the whole card on a
                    narrow phone */}
                <p className="break-words font-semibold text-charcoal-900">
                  {festival.name}
                </p>
                {/* the date sits in the footer of the card, not against the title:
                    a festival name wraps to one or two lines depending on its
                    length, and a chip that follows the text moves with it, so two
                    cards in the same row end up with their dates on different
                    baselines. pushed to the bottom instead, every date in the row
                    lines up. */}
                <div className="mt-auto pt-4">
                  {festival.happensOn ? (
                    <time
                      dateTime={festival.happensOn}
                      className="inline-flex items-center rounded-full bg-gold-50 px-3 py-1 text-sm font-medium tabular-nums text-gold-800"
                    >
                      {formatFestivalDate(festival.happensOn)}
                    </time>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-charcoal-50 px-3 py-1 text-sm font-medium text-charcoal-500">
                      Date to be announced
                    </span>
                  )}
                </div>
                {(() => {
                  const festivalHref = enquireHref(
                    temple,
                    [
                      enquiryGreeting(temple),
                      `I would like to know more about the ${festival.name} festival`,
                      festival.happensOn ? `on ${formatFestivalDate(festival.happensOn)}` : "",
                      "and the arrangements for visiting.",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  );
                  return festivalHref ? (
                    <a
                      href={festivalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-wine-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-wine-900"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enquire
                    </a>
                  ) : (
                    <p className="mt-4 w-full rounded-lg bg-charcoal-100 px-3 py-2 text-center text-sm font-medium text-charcoal-500">
                      Enquiries by phone only
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- services - full width */}
      {temple.services.length > 0 && (
        <div className={`${WIDE} mt-10`}>
          <div className="flex items-center gap-2.5 mb-6">
            <Sparkles className="h-5 w-5 shrink-0 text-gold-700" />
            <h2 className="font-display text-xl font-semibold text-charcoal-900">Services and pricing</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {temple.services.map((service) => (
              <div
                key={service.name}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-charcoal-100 bg-gradient-to-br from-ivory-50 to-white p-4 transition-all hover:border-gold-200 hover:shadow-md"
              >
                <p className="break-words font-semibold text-charcoal-900">{service.name}</p>
                {service.details && (
                  <p className="mt-2 flex-1 break-words text-sm leading-relaxed text-charcoal-600">
                    {service.details}
                  </p>
                )}
                {/* same footer slot as the festival cards above, so the price and
                    the date sit on the same line across both grids. the body font
                    rather than font-display: a rupee figure is data, and the
                    decorative face sets digits at an odd width that makes two
                    prices in the same row look like different amounts. tabular-nums
                    keeps the columns of digits aligned instead. */}
                <div className="mt-auto pt-4">
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full px-3 py-1 text-sm font-medium tabular-nums",
                      service.price > 0
                        ? "bg-gold-50 text-gold-800"
                        : "bg-charcoal-50 text-charcoal-500"
                    )}
                  >
                    {service.price > 0
                      ? `₹${service.price.toLocaleString("en-IN")}`
                      : "On request"}
                  </span>
                </div>
                {(() => {
                  const serviceHref = enquireHref(
                    temple,
                    [
                      enquiryGreeting(temple),
                      `I would like to enquire about ${service.name}`,
                      service.price > 0 ? `(${`₹${service.price.toLocaleString("en-IN")}`})` : "",
                      "and the availability. Please share more details.",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  );
                  return serviceHref ? (
                    <a
                      href={serviceHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-wine-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-wine-900"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enquire / Book
                    </a>
                  ) : (
                    <p className="mt-4 w-full rounded-lg bg-charcoal-100 px-3 py-2 text-center text-sm font-medium text-charcoal-500">
                      Enquiries by phone only
                    </p>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
      {temple.services.length === 0 && (
        <div className={`${WIDE} mt-10`}>
          <div className="flex items-center gap-2.5 mb-6">
            <Sparkles className="h-5 w-5 shrink-0 text-gold-700" />
            <h2 className="font-display text-xl font-semibold text-charcoal-900">Services and pricing</h2>
          </div>
          <p className="text-sm text-charcoal-500">
            Prices for this temple are not published yet. Call the temple
            office for the current rates.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------ map - last */}
      {/* last on the page: the story, the pictures and the prices are what a
          visitor reads first, and the map is the one thing they pull up once they
          have decided to come. */}
      {mapSrc && (
        <div className={`${WIDE} mt-10`}>
          {/* the address sits beside the map rather than under it: a pin answers
              "roughly where", and the written address is what a visitor copies
              into a taxi or a phone call. putting them side by side means the
              reading and the looking happen in the same glance. the same 1.6fr
              split the story column uses, so the two grids on the page line up. */}
          <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-8">
            <Panel
              icon={MapPin}
              title="Where it is"
              // the iframe runs to the card edge, so the card reads as one photo
              // panel instead of a picture floating in padding
              bodyClassName="p-0"
            >
              <div className="relative aspect-[16/10] w-full border-t border-charcoal-100 sm:aspect-[16/9]">
                <iframe
                  src={mapSrc}
                  // the title is what a screen reader announces for the frame,
                  // and "map" alone tells the visitor nothing
                  title={`Map showing the location of ${temple.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full border-0"
                  allowFullScreen
                />
              </div>
            </Panel>

            {address.length > 0 && (
              <Panel icon={MapPin} title="Full address" className="border-charcoal-100">
                <address className="min-w-0 break-words not-italic leading-relaxed text-charcoal-700">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                {temple.deity && (
                  <p className="mt-5 border-t border-charcoal-100 pt-4 text-sm text-charcoal-500">
                    {temple.deity}
                  </p>
                )}
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
