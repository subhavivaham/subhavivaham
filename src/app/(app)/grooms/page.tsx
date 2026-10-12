import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";
import { MemberPageHeader } from "@/components/layout/member-page-header";

// members only. a guest arriving from a public link lands on the login page,
// which is deliberate - browsing is a member benefit.
export const metadata: Metadata = {
  title: "Grooms — Subha Vivaham Matrimony",
  description:
    "Browse verified groom profiles from Tamil Nadu and across India. Search and filter by age, community, education and more.",
};

export default function GroomsPage() {
  return (
    <>
      <MemberPageHeader
        title="Grooms"
        description="Verified groom profiles. Refine the list by age, community, education, profession and location."
      />
      <SearchView gender="male" heading={false} />
    </>
  );
}
