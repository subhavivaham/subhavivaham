import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";

// the full list lives in the member area, not the public one. the home page
// shows a six profile preview and every browse call to action lands here, so a
// signed-out visitor is sent to the login wall by the (app) layout rather than
// being able to page through the whole database.
export const metadata: Metadata = {
  title: "Search Profiles — Subha Vivaham Matrimony",
  description:
    "Search and filter verified matrimonial profiles by age, religion, community, education, profession and more.",
};

export default function SearchPage() {
  return <SearchView />;
}
