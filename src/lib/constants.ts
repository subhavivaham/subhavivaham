// login page side panel art. the remote CDN links timed out behind next's image
// optimizer, so the file is vendored into src/assets instead of hotlinked.
import loginHero from "@/assets/login-hero.jpg";

export const BRAND = {
  name: "Subha Vivaham",
  nameTamil: "சுப விவாஹம்",
  tagline: "Traditional Values. Meaningful Matches.",
  oneLiner:
    "தமிழ் பாரம்பரியத்தின் நம்பிக்கையுடன், நவீன தொழில்நுட்பத்தில் உங்கள் வாழ்க்கைத் துணையைத் தேடும் தளம்.",
  positioning: "Subha Vivaham — Tamil Tradition. Trusted Matrimony.",
  website: "https://www.subhavivaham.com",
  owner: "S.Ramalingam Pillai",
  email: "subhavivaham2017@gmail.com",
  phone: "+91 88839 43711",
  whatsapp: "88839 43711",
  landline: "04630 - 261186",
  gstin: "33NPV5847N1Z5",
  offices: [
    {
      name: "Office 1",
      address: "1-56/1, Sub Register Off Street, Murappanadu, Tuticorin - 628 252",
    },
    {
      name: "Office 2",
      address: "3/58, Natarajar Sannathi Street, Vallanadu, Tuticorin - 628 252",
    },
  ],
  socials: {
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
    twitter: "https://x.com",
  },
} as const;

export const SITE_URL = "https://www.subhavivaham.com";

export const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export const STATIC_IMAGES = {
  hero: "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=1400&q=80",
  heroAlt: loginHero,
  couple1:
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80",
  couple2:
    "https://images.unsplash.com/photo-1518568814500-bf0f8d125f46?auto=format&fit=crop&w=1200&q=80",
  couple3:
    "https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=80",
} as const;

export const PUBLIC_NAV = [
  { label: "Home", href: "/" },
  { label: "Porutham", href: "/jathagam" },
  { label: "Communities", href: "/communities" },
  { label: "Temples", href: "/temples" },
  // { label: "Success Stories", href: "/success-stories" },
  { label: "Membership", href: "/membership" },
  { label: "Services", href: "/services" },
] as const;

export const MEMBER_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "My Profile", href: "/dashboard/profile", icon: "user-round" },
  { label: "My Matches", href: "/matches", icon: "sparkles" },
  { label: "Interests", href: "/interests", icon: "heart-handshake" },
  { label: "Membership", href: "/membership", icon: "crown" },
] as const;

export const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin", icon: "layout-dashboard" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Profiles", href: "/admin/profiles", icon: "contact" },
  { label: "Communities", href: "/admin/communities", icon: "users-round" },
  { label: "Memberships", href: "/admin/memberships", icon: "crown" },
  { label: "Vendor Services", href: "/admin/services", icon: "store" },
  { label: "Temples", href: "/admin/temples", icon: "landmark" },
  { label: "Configuration", href: "/admin/config", icon: "settings" },
] as const;

// a select holding a value outside its own list offers this, and the form then
// reveals a text field for the real answer. kept as a constant because the
// wizard, the validation and the register action all have to agree on it.
export const OTHER = "Other";

export const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Jain", "Buddhist", "Parsi", OTHER];

export const MOTHER_TONGUES = [
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Odia",
  "English",
  OTHER,
];

export const INDIAN_CITIES = [
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Mumbai",
  "Delhi",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Kochi",
  "Indore",
  "Chandigarh",
  "Coimbatore",
  "Visakhapatnam",
  "Nagpur",
];

// the 38 districts of Tamil Nadu. this is the taxonomy the public search filters
// on, kept separate from INDIAN_CITIES above because a profile may be registered
// from any city in the country while search is scoped to our home state.
export const TAMIL_NADU_DISTRICTS = [
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kanchipuram",
  "Kanyakumari",
  "Karur",
  "Krishnagiri",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "Nilgiris",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivagangai",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thiruvallur",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvannamalai",
  "Tiruvarur",
  "Vellore",
  "Villupuram",
  "Virudhunagar",
];

// all 28 states and 8 union territories, in the order india's census uses
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// cities/districts per state, used to keep the register city dropdown relevant
// to the chosen state. tamil nadu reuses the district taxonomy above so a
// profile registered from chennai reads back the same way search filters it.
export const STATE_CITIES: Record<string, string[]> = {
  Karnataka: [
    "Bangalore",
    "Mysuru",
    "Hubballi",
    "Mangaluru",
    "Belagavi",
    "Dharwad",
    "Davanagere",
    "Ballari",
    "Kalaburagi",
    "Vijayapura",
  ],
  "Tamil Nadu": TAMIL_NADU_DISTRICTS,
  Telangana: [
    "Hyderabad",
    "Warangal",
    "Nizamabad",
    "Karimnagar",
    "Khammam",
    "Mahbubnagar",
    "Mancherial",
    "Ramagundam",
  ],
  Maharashtra: [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Nashik",
    "Thane",
    "Aurangabad",
    "Kolhapur",
    "Solapur",
    "Amravati",
    "Nanded",
  ],
  Delhi: [
    "Delhi",
    "New Delhi",
    "Dwarka",
    "Rohini",
    "Saket",
    "Karol Bagh",
    "Nehru Place",
  ],
  "West Bengal": [
    "Kolkata",
    "Howrah",
    "Durgapur",
    "Asansol",
    "Siliguri",
    "Bardhaman",
    "Malda",
    "Kharagpur",
  ],
  Gujarat: [
    "Ahmedabad",
    "Surat",
    "Vadodara",
    "Rajkot",
    "Bhavnagar",
    "Jamnagar",
    "Junagadh",
    "Gandhinagar",
    "Anand",
  ],
  Rajasthan: [
    "Jaipur",
    "Jodhpur",
    "Udaipur",
    "Kota",
    "Ajmer",
    "Bikaner",
    "Bharatpur",
    "Jaisalmer",
  ],
  Kerala: [
    "Kochi",
    "Thiruvananthapuram",
    "Kozhikode",
    "Thrissur",
    "Malappuram",
    "Kannur",
    "Kollam",
    "Alappuzha",
  ],
  "Madhya Pradesh": [
    "Bhopal",
    "Indore",
    "Jabalpur",
    "Gwalior",
    "Ujjain",
    "Sagar",
    "Rewa",
    "Satna",
  ],
  Punjab: [
    "Ludhiana",
    "Amritsar",
    "Jalandhar",
    "Patiala",
    "Bathinda",
    "Mohali",
    "Pathankot",
    "Hoshiarpur",
  ],
  Haryana: [
    "Gurugram",
    "Faridabad",
    "Panipat",
    "Ambala",
    "Karnal",
    "Yamunanagar",
    "Rohtak",
    "Hisar",
  ],
  "Andhra Pradesh": [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Nellore",
    "Kurnool",
    "Rajahmundry",
    "Kakinada",
    "Tirupati",
  ],
  "Uttar Pradesh": [
    "Lucknow",
    "Kanpur",
    "Agra",
    "Varanasi",
    "Prayagraj",
    "Ghaziabad",
    "Meerut",
    "Bareilly",
    "Aligarh",
    "Moradabad",
  ],
};

export const EDUCATION_OPTIONS = [
  "B.E / B.Tech",
  "M.E / M.Tech",
  "B.Sc",
  "M.Sc",
  "B.Com",
  "M.Com",
  "BBA",
  "MBA",
  "CA",
  "MBBS",
  "MD / MS",
  "BDS",
  "B.Arch",
  "Ph.D",
  "BA",
  "MA",
  "LLB",
  "Diploma",
  "High School",
  OTHER,
];

export const PROFESSION_OPTIONS = [
  "Software Engineer",
  "Product Manager",
  "Data Scientist",
  "Doctor",
  "Consultant",
  "Banker",
  "Teacher",
  "Professor",
  "Architect",
  "Chartered Accountant",
  "Lawyer",
  "Civil Engineer",
  "Mechanical Engineer",
  "Marketing Manager",
  "Business Owner",
  "Civil Services",
  "Designer",
  "Analyst",
  "Nurse",
  "Pharmacist",
  OTHER,
];

// family and lifestyle are stored as slugs on profiles, so these carry a
// value/label pair rather than being plain string lists like EDUCATION_OPTIONS
export const FAMILY_TYPES = [
  { value: "nuclear", label: "Nuclear" },
  { value: "joint", label: "Joint" },
  { value: "extended", label: "Extended" },
] as const;

export const DIET_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "non-vegetarian", label: "Non-Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "jain", label: "Jain / Sattvik" },
  { value: "vegan", label: "Vegan" },
] as const;

export const SMOKING_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "occasionally", label: "Occasionally" },
  { value: "yes", label: "Yes" },
] as const;

export const DRINKING_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "occasionally", label: "Occasionally" },
  { value: "socially", label: "Socially" },
] as const;

export const INCOME_RANGES = [
  "₹0 - ₹5 Lakh",
  "₹5 - ₹10 Lakh",
  "₹10 - ₹15 Lakh",
  "₹15 - ₹25 Lakh",
  "₹25 - ₹50 Lakh",
  "₹50 Lakh - ₹1 Crore",
  "Above ₹1 Crore",
];

export const HEIGHTS = Array.from({ length: 25 }, (_, i) => 145 + i * 2); // 145cm - 193cm

/* -- profile photos -------------------------------------------------------- */

// the same rules are enforced twice: once in the register form so a member is
// told before they submit, and once in the register server action, which is an
// independently reachable endpoint and cannot trust the browser.
export const MIN_PHOTOS = 1;
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 500 * 1024;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// the accept attribute for <input type="file">, derived from the types above
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");

// the supabase storage bucket the register action uploads into. the matching
// bucket and policies live in migrations/0001_registration_photo_uploads.sql.
export const PHOTO_BUCKET = "profile-photos";

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function photoSizeError(bytes: number): string {
  return `Each photo must be ${formatBytes(MAX_PHOTO_BYTES)} or smaller — this one is ${formatBytes(bytes)}.`;
}

export function heightCmToText(cm: number): string {
  const feet = Math.floor(cm / 30.48);
  const inches = Math.round((cm - feet * 30.48) / 2.54);
  return `${feet}'${inches}"`;
}

const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// storage objects are keyed by path, not by mime type, so an uploaded file
// keeps a suffix a browser will render. shared by the register action and the
// admin photo upload so both name their files the same way.
export function photoExtension(mime: string): string {
  return PHOTO_EXTENSIONS[mime] ?? "jpg";
}

// -- temple images ----------------------------------------------------------
// A gallery cap rather than a "how many do you have" setting: five covers the
// brief, and a fixed number is the only version an admin can be sure of without
// reading the page.
export const MAX_TEMPLE_IMAGES = 5;

// 300 KB. Much tighter than the bucket's previous 5 MB because a temple gallery
// is decoration, not the product, and phone photos at 5 MB each made the public
// detail page heavy for no visible gain. Kept in step with the temple-images
// bucket's file_size_limit in table_creation.md — if you change one, change the
// other, or a file the form accepts will be rejected by storage with no useful
// message.
export const MAX_TEMPLE_IMAGE_BYTES = 300 * 1024;

export const TEMPLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const TEMPLE_IMAGE_ACCEPT = TEMPLE_IMAGE_TYPES.join(",");

export const TEMPLE_IMAGE_BUCKET = "temple-images";

// The uploaded cover is stored in the same bucket and under the same temple
// folder as the gallery, so the delete sweep that clears a temple's images
// cannot miss it. The prefix is what makes it identifiable as the cover rather
// than a gallery row, since it has no row of its own — temples.cover_image
// holds the url.
export const TEMPLE_COVER_PREFIX = "cover-";

export function templeImageSizeError(bytes: number): string {
  return `Each image must be ${formatBytes(MAX_TEMPLE_IMAGE_BYTES)} or smaller — this one is ${formatBytes(bytes)}.`;
}

// -- membership payments ----------------------------------------------------
// A member pays by UPI and uploads a screenshot, which an admin reconciles
// against the bank statement before approving. The proof lives in its own
// bucket rather than profile-photos because it can carry a transaction
// reference and must stay private.
export const PAYMENT_SCREENSHOT_BUCKET = "payment-screenshots";

// 2 MB. A phone screenshot of a UPI receipt is routinely larger than the 500 KB
// profile-photo cap, so this bucket allows more. Kept in step with the
// file_size_limit on the bucket in table_creation.md — if you change one,
// change the other, or a file the form accepts is rejected by storage with no
// useful message.
export const MAX_PAYMENT_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export const PAYMENT_SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const PAYMENT_SCREENSHOT_ACCEPT = PAYMENT_SCREENSHOT_TYPES.join(",");

export function paymentScreenshotSizeError(bytes: number): string {
  return `The screenshot must be ${formatBytes(MAX_PAYMENT_SCREENSHOT_BYTES)} or smaller — this one is ${formatBytes(bytes)}.`;
}

// the UPI id a member pays into. shown in the checkout modal beside the QR, so
// both routes to the same account are available when the QR will not scan.
export const UPI_ID = "viswa2506@oksbi";