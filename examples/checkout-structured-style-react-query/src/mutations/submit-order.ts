import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkoutStore } from "../store.ts";
import { submitOrder } from "../api.ts";

export function useSubmitOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOrder,
    onSuccess: (order) => {
      // Client state moves to "confirmation" and forgets the cart.
      checkoutStore.completeOrder(order.id);
      // Server state is invalidated so the order-history list refetches.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
