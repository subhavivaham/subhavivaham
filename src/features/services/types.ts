export type ServiceType = "mandapam" | "broker" | "catering" | "event" | "photography" | "decoration";

export type ServiceCategory = "catering" | "mandapam" | "wedding";

export interface ServiceProvider {
  id: string;
  type: ServiceType;
  name: string;
  contact: string;
  city: string;
  // street address of the premises. only asked for, only filled in and only shown
  // for a mandapam, which is the one category a visitor has to travel to; every
  // other category is a service that comes to them, so an address would be noise.
  address: string;
  phone: string;
  details: string;
  addedAt: string;
  // is_approved and active are separate gates and both must be true for the
  // listing to reach the public services page. is_approved means a human
  // reviewed it; active is the on/off switch for an already-approved listing.
  isApproved: boolean;
  active: boolean;
}

export const SERVICE_TYPES: ServiceType[] = [
  "catering",
  "mandapam",
  "photography",
  "decoration",
  "event",
  "broker",
];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  mandapam: "Mandapam",
  broker: "Franchise Partner",
  catering: "Catering",
  event: "Event Management",
  photography: "Photography",
  decoration: "Decoration",
};

export const SERVICE_CATEGORY_TYPES: Record<ServiceCategory, ServiceType[]> = {
  catering: ["catering"],
  mandapam: ["mandapam"],
  wedding: ["photography", "decoration", "event", "broker"],
};

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  catering: "Catering Services",
  mandapam: "Marriage Hall / Mandapam",
  wedding: "Wedding Services",
};

export function categoryOf(type: ServiceType): ServiceCategory {
  if (type === "catering") return "catering";
  if (type === "mandapam") return "mandapam";
  return "wedding";
}
