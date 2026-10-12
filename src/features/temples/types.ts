export interface TempleService {
  name: string;
  details: string;
  price: number;
}

export interface TempleImage {
  id: string;
  templeId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

// an upcoming festival. happensOn is a plain yyyy-mm-dd string, or "" when the
// date has not been announced — festivals follow the lunar calendar so the
// Gregorian date is re-entered each year, and "not yet announced" is a real
// state the form has to represent.
export interface TempleFestival {
  id: string;
  templeId: string;
  name: string;
  happensOn: string;
  sortOrder: number;
}

// One weekday's opening hours, as the admin typed it. Empty means the admin has
// not filled the day in, and the public page leaves it out. "Closed" is a value
// they choose deliberately, which is why it is not the same as "".
//
// Ordered Sunday first, matching both the seed order and how a temple visitor
// thinks about a week. Do not reorder this array without checking the column order
// in templeTimingsRow, which writes by the same sequence.
export type TempleDay =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

// A value that is safe to put in an href. Stricter than "contains a dot": the
// protocol is required, because a bare "example.com" is stored and rendered as a
// relative path and silently resolves to the site's own domain.
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Whether the value looks like something Google Maps handed out. The same host
// check mapsUrl() applies, kept in step deliberately: the form should refuse
// exactly the values the write path would silently drop, so an operator is told
// rather than left wondering why their link never appeared.
export function isGoogleMapsUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  let host: string;
  try {
    host = new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "maps.app.goo.gl" ||
    host.endsWith(".goo.gl") ||
    host === "youtu.be"
  );
}

export const TEMPLE_DAYS: readonly TempleDay[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface TempleDayTiming {
  day: TempleDay;
  // "" for an unset day, so it is hidden rather than rendered as a blank row
  hours: string;
}

export interface Temple {
  id: string;
  name: string;
  nameTa: string;
  deity: string;
  coverImage: string;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  // the pasted Google Maps share link, or "" when the admin has not set one.
  // the public page falls back to a text search of the address when it is empty.
  mapsUrl: string;
  history: string;
  // always seven entries, in TEMPLE_DAYS order, whatever the admin filled in
  timings: TempleDayTiming[];
  contact: string;
  whatsapp: string;
  email: string;
  contactPerson: string;
  website: string;
  services: TempleService[];
  images: TempleImage[];
  festivals: TempleFestival[];
  isApproved: boolean;
  active: boolean;
  addedAt: string;
}

// deliberately not derived from Temple with Omit: the registration form is a
// flat grid of text boxes, so every value is a string. it also has no services,
// flags or timestamps, and keeping it separate means a new column cannot
// silently become a required form field.
export interface TempleInput {
  name: string;
  nameTa: string;
  deity: string;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  mapsUrl: string;
  history: string;
  // seven strings in TEMPLE_DAYS order. plain strings rather than
  // TempleDayTiming[] because this is the flat form-field type and every value in
  // TempleInput is a string.
  timings: string[];
  contact: string;
  whatsapp: string;
  email: string;
  contactPerson: string;
  website: string;
}
