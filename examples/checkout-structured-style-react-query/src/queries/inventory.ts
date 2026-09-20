import { useQuery } from "@tanstack/react-query";
import { getInventory } from "../api.ts";

// Stock changes independently of this session, so it's revalidated on an
// interval rather than trusted from a single fetch.
export function useInventory(ids: string[]) {
  return useQuery({
    queryKey: ["inventory", ids],
    queryFn: () => getInventory(ids),
    enabled: ids.length > 0,
    refetchInterval: 4000,
  });
}
