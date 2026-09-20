import { useSelector } from "@kintools/store-react";
import { useCallback } from "react";

import { checkoutStore } from "../store.ts";
import { useCartPricing } from "../queries/pricing.ts";
import { useSubmitOrder } from "../mutations/submit-order.ts";
import { PricingBreakdown } from "./PricingBreakdown.tsx";

export function CheckoutForm() {
  const zip = useSelector(checkoutStore, (s) => s.zip);
  const items = useSelector(checkoutStore, (s) => s.items);
  const pricing = useCartPricing();
  const submitOrder = useSubmitOrder();

  const handleZipCodeBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      checkoutStore.setZip(e.target.value.trim());
    },
    [],
  );

  const handleBackClick = useCallback(() => {
    checkoutStore.setStep("cart");
  }, []);

  const handlePlaceOrderClick = useCallback(() => {
    if (!pricing.data) return;
    submitOrder.mutate({ items, total: pricing.data.total });
  }, [items, pricing.data, submitOrder]);

  return (
    <div className="space-y-4">
      <label className="block text-sm text-slate-400">
        Shipping ZIP code
        <input
          defaultValue={zip}
          onBlur={handleZipCodeBlur}
          placeholder="94107"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500 text-sm -outline-offset-2!"
        />
      </label>

      <PricingBreakdown />

      {submitOrder.error && (
        <div className="text-sm text-rose-400">
          {submitOrder.error instanceof Error
            ? submitOrder.error.message
            : "Failed to place order"}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleBackClick}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!zip || pricing.isFetching || !pricing.data ||
            submitOrder.isPending}
          onClick={handlePlaceOrderClick}
          className="flex-1 px-4 py-2 font-semibold rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed text-white cursor-pointer"
        >
          {submitOrder.isPending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
