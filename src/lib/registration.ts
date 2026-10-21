// the register wizard's shape and its rules, in one place.
//
// the form imports this to drive the five steps, and the register server action
// imports the same validateStep to re-check the submission. a server action is
// an independently reachable endpoint, so the browser's copy of these rules is
// a convenience for the member, never the guarantee.
import { MIN_PHOTOS, OTHER } from "@/lib/constants";
import { PHOTO_QUOTA } from "@/lib/payments/quota-defaults";

export interface RegistrationDraft {
  email: string;
  mobile: string;
  password: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  height: number;
  maritalStatus: string;
  religion: string;
  religionOther: string;
  communityOther: string;
  community: string;
  caste: string;
  motherTongue: string;
  motherTongueOther: string;
  education: string;
  educationOther: string;
  profession: string;
  professionOther: string;
  company: string;
  income: string;
  fatherOccupation: string;
  motherOccupation: string;
  brotherCount: string;
  sisterCount: string;
  familyType: string;
  familyLocation: string;
  familyValues: string;
  gotra: string;
  horoscopeRequired: string;
  diet: string;
  smoking: string;
  drinking: string;
  hobbies: string[];
  fitness: string;
  sports: string;
  music: string;
  food: string;
  appearances: string;
  country: string;
  state: string;
  district: string;
  city: string;
  about: string;
  prefMinAge: string;
  prefMaxAge: string;
  prefMinHeight: string;
  prefMaxHeight: string;
  prefReligion: string;
  prefReligionOther: string;
  prefMotherTongues: string[];
  prefCommunities: string[];
  prefEducations: string[];
  prefProfessions: string[];
  prefLocations: string[];
  prefMaritalStatuses: string[];
  prefDiet: string;
  prefSmoking: string;
  prefDrinking: string;
  prefIncome: string;
  prefProfession: string;
  prefProfessionOther: string;
}

export const initialRegistrationDraft: RegistrationDraft = {
  email: "",
  mobile: "",
  password: "",
  fullName: "",
  gender: "",
  dateOfBirth: "",
  height: 163,
  maritalStatus: "single",
  religion: "",
  religionOther: "",
  community: "",
  communityOther: "",
  caste: "",
  motherTongue: "",
  motherTongueOther: "",
  education: "",
  educationOther: "",
  profession: "",
  professionOther: "",
  company: "",
  income: "",
  fatherOccupation: "",
  motherOccupation: "",
  brotherCount: "",
  sisterCount: "",
  familyType: "",
  familyLocation: "",
  familyValues: "",
  gotra: "",
  horoscopeRequired: "no",
  diet: "",
  smoking: "",
  drinking: "",
  hobbies: [],
  fitness: "",
  sports: "",
  music: "",
  food: "",
  appearances: "",
  country: "India",
  state: "Tamil Nadu",
  district: "",
  city: "",
  about: "",
  prefMinAge: "25",
  prefMaxAge: "32",
  prefMinHeight: "150",
  prefMaxHeight: "190",
  prefReligion: "",
  prefReligionOther: "",
  prefMotherTongues: [],
  prefCommunities: [],
  prefEducations: [],
  prefProfessions: [],
  prefLocations: [],
  prefMaritalStatuses: ["single"],
  prefDiet: "",
  prefSmoking: "",
  prefDrinking: "",
  prefIncome: "",
  prefProfession: "",
  prefProfessionOther: "",
};

// every draft key that travels through FormData as a plain string. height is
// left out because it is a number, and the two array fields are left out because
// they travel as one repeated entry per selection.
export type RegistrationTextField = Exclude<
  keyof RegistrationDraft,
  "height" | "prefLocations" | "hobbies" | "prefMotherTongues" | "prefCommunities" | "prefEducations" | "prefProfessions" | "prefMaritalStatuses"
>;

export const REGISTRATION_TEXT_FIELDS: readonly RegistrationTextField[] = [
  "email",
  "mobile",
  "password",
  "fullName",
  "gender",
  "dateOfBirth",
  "maritalStatus",
  "religion",
  "religionOther",
  "community",
  "communityOther",
  "caste",
  "motherTongue",
  "motherTongueOther",
  "education",
  "educationOther",
  "profession",
  "professionOther",
  "company",
  "income",
  "fatherOccupation",
  "motherOccupation",
  "brotherCount",
  "sisterCount",
  "familyType",
  "familyLocation",
  "familyValues",
  "gotra",
  "horoscopeRequired",
  "diet",
  "smoking",
  "drinking",
  "fitness",
  "sports",
  "music",
  "food",
  "appearances",
  "country",
  "state",
  "district",
  "city",
  "about",
  "prefMinAge",
  "prefMaxAge",
  "prefMinHeight",
  "prefMaxHeight",
  "prefReligion",
  "prefReligionOther",
  "prefProfession",
  "prefProfessionOther",
  "prefDiet",
  "prefSmoking",
  "prefDrinking",
  "prefIncome",
];

// fields the client appends once per selected option, so the action has to read
// them with getAll rather than get.
export const REGISTRATION_LIST_FIELDS = ["prefLocations", "hobbies", "prefMotherTongues", "prefCommunities", "prefEducations", "prefProfessions", "prefMaritalStatuses"] as const;
export type RegistrationListField = (typeof REGISTRATION_LIST_FIELDS)[number];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
// the introduction is the first thing a potential match reads, so 40 characters
// was low enough to be satisfied by a single lazy sentence. counted on the
// trimmed value, so trailing whitespace cannot pad a short answer past the bar.
export const ABOUT_MIN = 300;
// no column limit on profiles.about, so the ceiling has to be enforced here or
// a pasted essay would be stored and then truncated by nothing at all.
export const ABOUT_MAX = 1500;

// "photos" is not a draft key - the images are File objects, not form fields -
// but the photo rules need somewhere to report an error, so it joins the map.
export type RegistrationErrors = Partial<Record<keyof RegistrationDraft | "photos", string>>;

export function ageFromDob(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

// a select left on OTHER says nothing on its own, so the typed answer becomes
// the stored value. storing the literal "Other" instead would collapse every
// custom religion, qualification and profession into one indistinguishable
// bucket and leave the search filters nothing to match against.
export function resolveChoice(choice: string, other: string): string {
  if (choice !== OTHER) return choice.trim();
  return other.trim() || OTHER;
}

// step is 1-based and matches the wizard's step order. photoCount is passed
// separately because the images are not part of the draft.
export function validateRegistrationStep(
  step: number,
  d: RegistrationDraft,
  photoCount: number,
  freePhotoLimit: number = PHOTO_QUOTA.free
): RegistrationErrors {
  const e: RegistrationErrors = {};

  if (step === 1) {
    if (!d.email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(d.email.trim())) e.email = "Enter a valid email address";
    if (!d.mobile.trim()) e.mobile = "Mobile number is required";
    else if (!MOBILE_RE.test(d.mobile.replace(/[\s+-]/g, "")))
      e.mobile = "Enter a valid 10-digit mobile number";
    if (!d.password) e.password = "Password is required";
    else if (d.password.length < 8) e.password = "Use at least 8 characters";
  }

  if (step === 2) {
    if (!d.fullName.trim()) e.fullName = "Full name is required";
    if (!d.gender) e.gender = "Select whether you are a bride or a groom";
    if (!d.dateOfBirth) e.dateOfBirth = "Date of birth is required";
    else {
      const age = ageFromDob(d.dateOfBirth);
      if (Number.isNaN(age) || age > 100) e.dateOfBirth = "Enter a valid date of birth";
      else if (age < 18) e.dateOfBirth = "You must be at least 18 years old";
    }
  }

  if (step === 3) {
    if (!d.religion) e.religion = "Select your religion";
    else if (d.religion === OTHER && !d.religionOther.trim())
      e.religionOther = "Enter your religion";
    if (!d.motherTongue) e.motherTongue = "Select your mother tongue";
    else if (d.motherTongue === OTHER && !d.motherTongueOther.trim())
      e.motherTongueOther = "Enter your mother tongue";
    if (d.community === OTHER && !d.communityOther.trim())
      e.communityOther = "Enter your community";
    if (!d.education) e.education = "Select your highest education";
    else if (d.education === OTHER && !d.educationOther.trim())
      e.educationOther = "Enter your qualification";
    if (!d.profession) e.profession = "Select your profession";
    else if (d.profession === OTHER && !d.professionOther.trim())
      e.professionOther = "Enter your profession";
  }

  if (step === 4) {
    if (!d.familyType) e.familyType = "Select your family type";
    if (Number(d.brotherCount) < 0 || Number.isNaN(Number(d.brotherCount)))
      e.brotherCount = "Enter a number";
    if (Number(d.sisterCount) < 0 || Number.isNaN(Number(d.sisterCount)))
      e.sisterCount = "Enter a number";
  }

  if (step === 5) {
    if (!d.diet) e.diet = "Select your diet";
    if (!d.smoking) e.smoking = "Select your smoking habit";
    if (!d.drinking) e.drinking = "Select your drinking habit";
  }

  if (step === 6) {
    if (!d.district) e.district = "Select your district";
    if (!d.city.trim()) e.city = "Enter your city";
    if (!d.about.trim()) e.about = "Write a short introduction";
    else if (d.about.trim().length < ABOUT_MIN)
      e.about = `Add a little more — ${ABOUT_MIN - d.about.trim().length} more characters needed`;
    else if (d.about.trim().length > ABOUT_MAX)
      e.about = `That is ${d.about.trim().length - ABOUT_MAX} characters over the ${ABOUT_MAX} limit`;
  }

  if (step === 7) {
    const min = Number(d.prefMinAge);
    const max = Number(d.prefMaxAge);
    if (min < 18) e.prefMinAge = "Must be at least 18";
    if (max <= min) e.prefMaxAge = "Maximum age must be greater than minimum";
    if (d.prefReligion === OTHER && !d.prefReligionOther.trim())
      e.prefReligionOther = "Enter the religion you prefer";
    if (d.prefProfession === OTHER && !d.prefProfessionOther.trim())
      e.prefProfessionOther = "Enter the profession you prefer";
  }

  if (step === 8) {
    if (photoCount < MIN_PHOTOS)
      e.photos = `Add at least ${MIN_PHOTOS} photo so members can see you`;
    else if (photoCount > freePhotoLimit)
      e.photos = `You can add at most ${freePhotoLimit} photo to start with`;
  }

  return e;
}
