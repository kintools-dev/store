import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeOrder } from "../stores.ts";
import { submitOrder } from "../api.ts";

export function useSubmitOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOrder,
    onSuccess: (order) => {
      // Client state moves to "confirmation" and clears the cart.
      completeOrder(order.id);
      // Server state is invalidated so the order-history list refetches.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: () => {
      // A failure here (e.g. insufficient stock) means our cached inventory
      // was stale. Refetch it so the catalog/cart reflect reality.
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
