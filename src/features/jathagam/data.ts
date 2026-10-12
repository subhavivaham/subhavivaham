export type Gana = "deva" | "manushya" | "rakshasa";
export type Yoni = string;

export interface Nakshatra {
  id: number;
  name: string;
  tamilName: string;
  rasi: number;
  gana: Gana;
  yoni: Yoni;
  lord: string;
}

export const RASI_NAMES = [
  "Mesham",
  "Rishabham",
  "Mithunam",
  "Katakam",
  "Simham",
  "Kanni",
  "Thulam",
  "Vrichikam",
  "Dhanusu",
  "Makaram",
  "Kumbam",
  "Meenam",
] as const;

export const RASI_TAMIL = [
  "மேஷம்",
  "ரிஷபம்",
  "மிதுனம்",
  "கடகம்",
  "சிம்மம்",
  "கன்னி",
  "துலாம்",
  "விருச்சிகம்",
  "தனுசு",
  "மகரம்",
  "கும்பம்",
  "மீனம்",
] as const;

export const RASI_LORDS: Record<number, string> = {
  1: "Mangala (Mars)",
  2: "Shukra (Venus)",
  3: "Budha (Mercury)",
  4: "Chandra (Moon)",
  5: "Surya (Sun)",
  6: "Budha (Mercury)",
  7: "Shukra (Venus)",
  8: "Mangala (Mars)",
  9: "Guru (Jupiter)",
  10: "Shani (Saturn)",
  11: "Shani (Saturn)",
  12: "Guru (Jupiter)",
};

/**
 * Each rasi covers 30 degrees of the zodiac, counted from Mesham at 0. Derived
 * from the rasi order rather than typed out, so a boundary cannot be wrong the
 * way a hand-written list eventually is.
 */
export const RASI_RANGES: readonly string[] = RASI_NAMES.map(
  (_, i) => `${i * 30}° – ${(i + 1) * 30}°`
);

export const GANA_TAMIL: Record<Gana, string> = {
  deva: "தேவ கணம்",
  manushya: "மனித கணம்",
  rakshasa: "ராட்சச கணம்",
};

export const nakshatras: Nakshatra[] = [
  { id: 1, name: "Ashwini", tamilName: "அஸ்வினி", rasi: 1, gana: "deva", yoni: "Ashwa (Horse)", lord: "Ketu" },
  { id: 2, name: "Bharani", tamilName: "பரணி", rasi: 1, gana: "manushya", yoni: "Hasti (Elephant)", lord: "Shukra" },
  { id: 3, name: "Krittika", tamilName: "கார்த்திகை", rasi: 2, gana: "rakshasa", yoni: "Mesha (Goat)", lord: "Surya" },
  { id: 4, name: "Rohini", tamilName: "ரோகிணி", rasi: 2, gana: "manushya", yoni: "Sarpa (Serpent)", lord: "Chandra" },
  { id: 5, name: "Mrigashirsha", tamilName: "மிருகசிரீடம்", rasi: 3, gana: "deva", yoni: "Sarpa (Serpent)", lord: "Mangala" },
  { id: 6, name: "Ardra", tamilName: "திருவாதிரை", rasi: 3, gana: "manushya", yoni: "Shwa (Dog)", lord: "Rahu" },
  { id: 7, name: "Punarvasu", tamilName: "புனர்பூசம்", rasi: 4, gana: "deva", yoni: "Mardara (Cat)", lord: "Guru" },
  { id: 8, name: "Pushya", tamilName: "பூசம்", rasi: 4, gana: "deva", yoni: "Mesha (Goat)", lord: "Shani" },
  { id: 9, name: "Ashlesha", tamilName: "ஆயில்யம்", rasi: 4, gana: "rakshasa", yoni: "Mardara (Cat)", lord: "Budha" },
  { id: 10, name: "Magha", tamilName: "மகம்", rasi: 5, gana: "rakshasa", yoni: "Mushak (Rat)", lord: "Ketu" },
  { id: 11, name: "Purva Phalguni", tamilName: "பூரம்", rasi: 5, gana: "manushya", yoni: "Mushak (Rat)", lord: "Shukra" },
  { id: 12, name: "Uttara Phalguni", tamilName: "உத்திரம்", rasi: 6, gana: "manushya", yoni: "Gou (Cow)", lord: "Surya" },
  { id: 13, name: "Hasta", tamilName: "அஸ்தம்", rasi: 6, gana: "deva", yoni: "Mahish (Buffalo)", lord: "Chandra" },
  { id: 14, name: "Chitra", tamilName: "சித்திரை", rasi: 7, gana: "rakshasa", yoni: "Vyagra (Tiger)", lord: "Mangala" },
  { id: 15, name: "Swati", tamilName: "சுவாதி", rasi: 7, gana: "deva", yoni: "Mahish (Buffalo)", lord: "Rahu" },
  { id: 16, name: "Vishakha", tamilName: "விசாகம்", rasi: 8, gana: "rakshasa", yoni: "Vyagra (Tiger)", lord: "Guru" },
  { id: 17, name: "Anuradha", tamilName: "அனுஷம்", rasi: 8, gana: "deva", yoni: "Mriga (Deer)", lord: "Shani" },
  { id: 18, name: "Jyeshtha", tamilName: "கேட்டை", rasi: 8, gana: "rakshasa", yoni: "Mriga (Deer)", lord: "Budha" },
  { id: 19, name: "Mula", tamilName: "மூலம்", rasi: 9, gana: "rakshasa", yoni: "Shwa (Dog)", lord: "Ketu" },
  { id: 20, name: "Purva Ashadha", tamilName: "பூராடம்", rasi: 9, gana: "manushya", yoni: "Vanara (Monkey)", lord: "Shukra" },
  { id: 21, name: "Uttara Ashadha", tamilName: "உத்திராடம்", rasi: 10, gana: "manushya", yoni: "Nakula (Mongoose)", lord: "Surya" },
  { id: 22, name: "Shravana", tamilName: "திருவோணம்", rasi: 10, gana: "deva", yoni: "Vanara (Monkey)", lord: "Chandra" },
  { id: 23, name: "Dhanishta", tamilName: "அவிட்டம்", rasi: 11, gana: "rakshasa", yoni: "Simha (Lion)", lord: "Mangala" },
  { id: 24, name: "Shatabhisha", tamilName: "சதயம்", rasi: 11, gana: "rakshasa", yoni: "Ashwa (Horse)", lord: "Rahu" },
  { id: 25, name: "Purva Bhadrapada", tamilName: "பூரட்டாதி", rasi: 12, gana: "manushya", yoni: "Simha (Lion)", lord: "Guru" },
  { id: 26, name: "Uttara Bhadrapada", tamilName: "உத்திரட்டாதி", rasi: 12, gana: "manushya", yoni: "Gou (Cow)", lord: "Shani" },
  { id: 27, name: "Revati", tamilName: "ரேவதி", rasi: 12, gana: "deva", yoni: "Hasti (Elephant)", lord: "Budha" },
];

export function getNakshatraById(id: number): Nakshatra {
  return nakshatras[(id - 1 + 27) % 27];
}