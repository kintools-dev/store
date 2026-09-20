import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useStore } from "@kintools/store-react";
import { itemsStore, promoCodeStore, zipStore } from "../stores.ts";
import { calculatePricing } from "../api.ts";

// A dependent query: its inputs (cart items, promo code, zip) are read
// straight from Kin Store, and its query key changes whenever they do. The
// server, not the client, owns tax/shipping/discount math.
export function useCartPricing() {
  const items = useStore(itemsStore);
  const promoCode = useStore(promoCodeStore);
  const zip = useStore(zipStore);

  return useQuery({
    queryKey: ["pricing", items, promoCode, zip],
    queryFn: () => calculatePricing({ items, promoCode, zip }),
    enabled: items.length > 0,
    // Every edit changes the query key. Keep the last total on screen
    // instead of it vanishing while the new one loads.
    placeholderData: keepPreviousData,
  });
}
