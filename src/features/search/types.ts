import type { Gender, MaritalStatus, Diet, Drink, Smoke } from "@/types";

export type SortKey = "recommended" | "recently-active" | "newest" | "age";

export interface SearchFilters {
  ageMin?: number;
  ageMax?: number;
  gender?: Gender;
  location?: string;
  religion?: string;
  community?: string;
  motherTongue?: string;
  education?: string;
  profession?: string;
  maritalStatus?: MaritalStatus;
  heightMin?: number;
  heightMax?: number;
  diet?: Diet;
  drinking?: Drink;
  smoking?: Smoke;
  income?: string;
  withPhoto?: boolean;
}