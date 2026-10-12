export type Gender = "female" | "male";
export type MaritalStatus =
  | "single"
  | "divorced"
  | "widowed"
  | "annulled";
export type Diet =
  | "vegetarian"
  | "non-vegetarian"
  | "eggetarian"
  | "jain"
  | "vegan";
export type Drink = "never" | "occasionally" | "socially";
export type Smoke = "never" | "occasionally" | "yes";
export type FamilyType = "nuclear" | "joint" | "extended";
export type MembershipTier = "free" | "silver" | "premium";

export type InterestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type ProfileStatus = "active" | "inactive" | "rejected";
export type StoryStatus = "published" | "draft";
export type AdminRole = "member" | "admin";
export type UserStatus = "active" | "suspended" | "blocked";
export type SubscriptionStatus = "active" | "cancelled" | "expired";
export type PaymentStatus = "pending" | "approved" | "rejected";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: UserStatus;
  membership: MembershipTier;
  joinedAt: string;
  phoneNumber?: string;
  isMembershipUser?: boolean;
  membershipPlan?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  memberName: string;
  plan: MembershipTier;
  amount: number;
  renewsOn: string;
  status: SubscriptionStatus;
  createdAt: string;
}

export interface MembershipPayment {
  id: string;
  userId: string;
  memberName: string;
  plan: MembershipTier;
  planName: string;
  amount: number;
  // the storage object path in PAYMENT_SCREENSHOT_BUCKET. the bucket is private,
  // so this is not a url: screenshotUrl is a short-lived signed url the admin
  // list resolves at read time.
  screenshotPath: string;
  screenshotUrl: string;
  status: PaymentStatus;
  note: string;
  createdAt: string;
  reviewedAt: string;
}

export interface ProfilePhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  caption?: string;
}

export interface FamilyDetails {
  fatherOccupation: string;
  motherOccupation: string;
  brotherCount: number;
  sisterCount: number;
  familyType: FamilyType;
  familyLocation: string;
  familyValues: string;
  gotra?: string;
  horoscopeRequired: boolean;
}

export interface Lifestyle {
  diet: Diet;
  smoking: Smoke;
  drinking: Drink;
  hobbies: string[];
  fitness: string;
  sports: string;
  music: string;
  food: string;
  appearances: string;
}

export interface PartnerPreference {
  minAge: number;
  maxAge: number;
  minHeight: number;
  maxHeight: number;
  religion: string;
  communities: string[];
  motherTongues: string[];
  education: string[];
  professions: string[];
  locations: string[];
  income?: string;
  diet: Diet;
  smoking: Smoke;
  drinking: Drink;
  maritalStatuses: MaritalStatus[];
}

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  firstName: string;
  gender: Gender;
  dateOfBirth: string;
  age: number;
  height: number;
  heightText: string;
  maritalStatus: MaritalStatus;
  religion: string;
  community: string;
  // optional: the column is nullable and seeded/legacy rows do not have one
  caste?: string;
  motherTongue: string;
  education: string;
  college: string;
  profession: string;
  company: string;
  income: string;
  country: string;
  state: string;
  // optional: the column is nullable and seeded/legacy rows do not have one
  district?: string;
  city: string;
  about: string;
  photos: ProfilePhoto[];
  verified: boolean;
  status: ProfileStatus;
  online: boolean;
  lastActive: string;
  profileCreatedOn: string;
  horoscopeLink?: string;
  family: FamilyDetails;
  lifestyle: Lifestyle;
  preference: PartnerPreference;
  matchPercentage?: number;
}

export interface Interest {
  id: string;
  profile: Profile;
  status: InterestStatus;
  message?: string;
  direction: "received" | "sent";
  createdAt: string;
  viewed?: boolean;
}

export interface PlanCompareFeature {
  label: string;
  value: boolean | string;
}

export interface MembershipPlan {
  id: string;
  name: MembershipTier;
  label: string;
  subtitle?: string;
  price: number;
  labelPrice: string;
  period: string;
  popular?: boolean;
  features: { label: string; included: boolean }[];
  compareFeatures?: PlanCompareFeature[];
  photoLimit: number;
  interestLimit: number | null;
}

export interface AppUser {
  id: string;
  email: string;
  // users.phone_number, written once at registration. the profile editor shows it
  // read-only, so it is carried here rather than read a second time on that page.
  mobile: string;
  name: string;
  profileId: string;
  // from profiles.gender, so the member area can greet a groom as a groom and a
  // bride as a bride. null while the profile row is missing, which is the case
  // between sign-up and the first successful read.
  gender: "male" | "female" | null;
  // the member's live plan tier, so nav and gates can hide premium-only
  // entries without another round trip. resolved at sign-in from the same
  // users row as everything else above.
  plan: "free" | "silver" | "premium";
}

export interface RegisterDraft {
  step: number;
  totalSteps: number;
}

export interface Stats {
  newMatches: number;
  interestsReceived: number;
  interestsSent: number;
}