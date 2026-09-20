import { useQuery } from "@tanstack/react-query";
import { getOrders } from "../api.ts";

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
  });
}
