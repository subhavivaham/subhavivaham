"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface HomeSearchFilters {
  gender: string;
  ageMin: string;
  ageMax: string;
  religion: string;
  location: string;
}

// the search widget opens with these, and the featured grid starts on the same
// values, so the homepage shows the same eight profiles the widget describes
export const HOME_SEARCH_DEFAULTS: HomeSearchFilters = {
  gender: "female",
  ageMin: "22",
  ageMax: "35",
  religion: "",
  location: "",
};

interface HomeSearchValue {
  filters: HomeSearchFilters;
  setFilter: (patch: Partial<HomeSearchFilters>) => void;
  reset: () => void;
}

const HomeSearchContext = createContext<HomeSearchValue | null>(null);

export function HomeSearchProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<HomeSearchFilters>(HOME_SEARCH_DEFAULTS);

  // both callbacks are deliberately stable. the search widget reports itself
  // from an effect keyed on setFilter, and a fresh function every render would
  // re-fire that effect and loop
  const setFilter = useCallback((patch: Partial<HomeSearchFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setFilters(HOME_SEARCH_DEFAULTS), []);

  const value = useMemo(
    () => ({ filters, setFilter, reset }),
    [filters, setFilter, reset]
  );

  return (
    <HomeSearchContext.Provider value={value}>{children}</HomeSearchContext.Provider>
  );
}

// null outside the homepage, so the same widget still works on a page that
// searches by navigating away instead of filtering in place
export function useHomeSearch() {
  return useContext(HomeSearchContext);
}
