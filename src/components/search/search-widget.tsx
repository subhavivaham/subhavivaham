"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { RELIGIONS } from "@/lib/constants";
import { queryString } from "@/features/search/helpers";
import { useHomeSearch } from "@/features/search/home-search";

export function SearchWidget({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [lookingFor, setLookingFor] = useState("female");
  const [ageMin, setAgeMin] = useState("22");
  const [ageMax, setAgeMax] = useState("35");
  const [religion, setReligion] = useState("");

  // on the homepage the featured grid below reads these, so a change filters it
  // without a submit. elsewhere the context is null and the form keeps working
  // as a plain navigate-on-submit search
  const homeSearch = useHomeSearch();
  const setFilter = homeSearch?.setFilter;

  useEffect(() => {
    setFilter?.({ gender: lookingFor, ageMin, ageMax, religion });
  }, [setFilter, lookingFor, ageMin, ageMax, religion]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // on the homepage, don't navigate away — make sure the featured grid shows
    // the current filters and bring it into view
    if (homeSearch) {
      setFilter?.({ gender: lookingFor, ageMin, ageMax, religion });
      document
        .getElementById("featured-profiles")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push(
      `/search?${queryString({
        gender: lookingFor,
        ageMin,
        ageMax,
        religion,
      })}`
    );
  };

  return (
    <form
      onSubmit={onSearch}
      className={`grid w-full gap-4 rounded-3xl border border-charcoal-100 bg-white shadow-soft sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] ${compact ? "p-6 sm:p-8" : "p-8 sm:p-10"}`}
    >
      <Select
        label="Looking for"
        value={lookingFor}
        onChange={(e) => setLookingFor(e.target.value)}
        className="h-12 px-4"
      >
        <option value="male">Groom</option>
        <option value="female">Bride</option>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Min age" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className="h-12 px-4">
          {Array.from({ length: 30 }, (_, i) => 18 + i).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select label="Max age" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className="h-12 px-4">
          {Array.from({ length: 30 }, (_, i) => 18 + i).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <Select
        label="Religion"
        value={religion}
        onChange={(e) => setReligion(e.target.value)}
        className="h-12 px-4"
      >
        <option value="">Any</option>
        {RELIGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <div className="flex items-end">
        <Button type="submit" size="lg" fullWidth className="h-12">
          <Search className="h-4 w-4" /> Search Profiles
        </Button>
      </div>
    </form>
  );
}