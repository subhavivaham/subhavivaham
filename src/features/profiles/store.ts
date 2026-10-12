import type { FamilyType, Gender, MaritalStatus, Profile } from "@/types";

// Profile reads and writes go through the database: lib/data/queries.ts for
// public reads, lib/data/admin-queries.ts and app/(admin)/admin/actions.ts for
// admin writes. This file only holds the shape the admin form submits.

// the admin form covers the same ground as the registration wizard, one field
// for one field, so a profile an admin types in carries everything a member's
// own submission does. the extra column here is "college": the wizard has no
// field for it, but the profiles table holds one and the public cards show it.
//
// caste and district are nullable on the row, so they are redeclared here as
// plain strings - an empty string is how the form says "not filled in yet".
type ProfileFormScalars = Pick<
  Profile,
  | "fullName"
  | "gender"
  | "dateOfBirth"
  | "height"
  | "maritalStatus"
  | "religion"
  | "community"
  | "motherTongue"
  | "education"
  | "college"
  | "profession"
  | "company"
  | "income"
  | "country"
  | "state"
  | "city"
  | "about"
>;

export type ProfileInput = ProfileFormScalars & {
  caste: string;
  district: string;
  // family
  fatherOccupation: string;
  motherOccupation: string;
  brotherCount: number;
  sisterCount: number;
  familyType: FamilyType;
  familyLocation: string;
  familyValues: string;
  gotra: string;
  horoscopeRequired: boolean;
  // lifestyle
  diet: string;
  smoking: string;
  drinking: string;
  hobbies: string[];
  fitness: string;
  sports: string;
  music: string;
  food: string;
  appearances: string;
  // partner preference
  prefMinAge: number;
  prefMaxAge: number;
  prefMinHeight: number;
  prefMaxHeight: number;
  prefReligion: string;
  prefCommunities: string[];
  prefMotherTongues: string[];
  prefEducations: string[];
  prefProfessions: string[];
  prefLocations: string[];
  prefMaritalStatuses: string[];
  prefIncome: string;
  prefDiet: string;
  prefSmoking: string;
  prefDrinking: string;
};

export function emptyProfileDraft(gender: Gender): ProfileInput {
  return {
    fullName: "",
    gender,
    dateOfBirth: "",
    height: 163,
    maritalStatus: "single" as MaritalStatus,
    religion: "",
    community: "",
    caste: "",
    motherTongue: "",
    education: "",
    college: "",
    profession: "",
    company: "",
    income: "",
    country: "India",
    state: "Tamil Nadu",
    district: "",
    city: "",
    about: "",
    fatherOccupation: "",
    motherOccupation: "",
    brotherCount: 0,
    sisterCount: 0,
    familyType: "nuclear" as FamilyType,
    familyLocation: "",
    familyValues: "",
    gotra: "",
    horoscopeRequired: false,
    diet: "",
    smoking: "",
    drinking: "",
    hobbies: [],
    fitness: "",
    sports: "",
    music: "",
    food: "",
    appearances: "",
    prefMinAge: 25,
    prefMaxAge: 32,
    prefMinHeight: 150,
    prefMaxHeight: 190,
    prefReligion: "",
    prefCommunities: [],
    prefMotherTongues: [],
    prefEducations: [],
    prefProfessions: [],
    prefLocations: [],
    prefMaritalStatuses: ["single"],
    prefIncome: "",
    prefDiet: "",
    prefSmoking: "",
    prefDrinking: "",
  };
}

// the inverse of emptyProfileDraft: the admin modal opens on an existing profile
// with every field the row holds, including the family, lifestyle and preference
// blocks that the database keeps flat on profiles
export function profileToInput(p: Profile): ProfileInput {
  return {
    fullName: p.fullName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    height: p.height,
    maritalStatus: p.maritalStatus,
    religion: p.religion,
    community: p.community,
    caste: p.caste ?? "",
    motherTongue: p.motherTongue,
    education: p.education,
    college: p.college,
    profession: p.profession,
    company: p.company,
    income: p.income,
    country: p.country,
    state: p.state,
    district: p.district ?? "",
    city: p.city,
    about: p.about,
    fatherOccupation: p.family.fatherOccupation,
    motherOccupation: p.family.motherOccupation,
    brotherCount: p.family.brotherCount,
    sisterCount: p.family.sisterCount,
    familyType: p.family.familyType,
    familyLocation: p.family.familyLocation,
    familyValues: p.family.familyValues,
    gotra: p.family.gotra ?? "",
    horoscopeRequired: p.family.horoscopeRequired,
    diet: p.lifestyle.diet,
    smoking: p.lifestyle.smoking,
    drinking: p.lifestyle.drinking,
    hobbies: [...p.lifestyle.hobbies],
    fitness: p.lifestyle.fitness,
    sports: p.lifestyle.sports,
    music: p.lifestyle.music,
    food: p.lifestyle.food,
    appearances: p.lifestyle.appearances,
    prefMinAge: p.preference.minAge,
    prefMaxAge: p.preference.maxAge,
    prefMinHeight: p.preference.minHeight,
    prefMaxHeight: p.preference.maxHeight,
    prefReligion: p.preference.religion,
    prefMotherTongues: [...p.preference.motherTongues],
    prefCommunities: [...p.preference.communities],
    prefEducations: [...p.preference.education],
    prefProfessions: [...p.preference.professions],
    prefLocations: [...p.preference.locations],
    prefMaritalStatuses: [...p.preference.maritalStatuses],
    prefIncome: p.preference.income ?? "",
    prefDiet: p.preference.diet,
    prefSmoking: p.preference.smoking,
    prefDrinking: p.preference.drinking,
  };
}

// the wizard splits its age pickers into two lists (a floor that starts at 21
// and a ceiling that starts at 23) so neither end can offer a range the other
// cannot match. the admin form reuses the same ranges.
export const MIN_AGE_OPTIONS = Array.from({ length: 25 }, (_, i) => 21 + i);
export const MAX_AGE_OPTIONS = Array.from({ length: 30 }, (_, i) => 23 + i);
