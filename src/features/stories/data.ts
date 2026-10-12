import type { StoryStatus } from "@/types";

export interface SuccessStory {
  id: string;
  couple: string;
  shortNames: string;
  location: string;
  image: string;
  matchPercent: number;
  tagline: string;
  quote: string;
  story: string[];
  daysMatched: string;
  status: StoryStatus;
}

