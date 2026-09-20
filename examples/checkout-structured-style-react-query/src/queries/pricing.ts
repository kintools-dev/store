import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "../store.ts";
import { calculatePricing } from "../api.ts";

// A dependent query: its inputs (cart items, promo code, zip) are read
// straight from Kin Store, and its query key changes whenever they do. The
// server, not the client, owns tax/shipping/discount math.
export function useCartPricing() {
  const items = useSelector(checkoutStore, (s) => s.items);
  const promoCode = useSelector(checkoutStore, (s) => s.promoCode);
  const zip = useSelector(checkoutStore, (s) => s.zip);

  return useQuery({
    queryKey: ["pricing", items, promoCode, zip],
    queryFn: () => calculatePricing({ items, promoCode, zip }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  });
}
