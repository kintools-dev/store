import { useQuery } from "@tanstack/react-query";
import { getProductCatalog } from "../api.ts";

// One cached fetch, shared by both the catalog grid and the cart summary.
export function useProductCatalog() {
  return useQuery({
    queryKey: ["products"],
    queryFn: getProductCatalog,
    staleTime: 60_000,
  });
}
