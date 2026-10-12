export function queryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

export function parseQuery(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(search);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}