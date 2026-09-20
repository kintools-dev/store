import { useStore } from "@kintools/store-react";
import { useCallback } from "react";

import { useProductCatalog } from "../queries/products.ts";
import { PricingBreakdown } from "./PricingBreakdown.tsx";
import {
  applyPromoCode,
  itemsStore,
  promoCodeStore,
  setQuantity,
  stepStore,
} from "../stores.ts";

export function CartPanel() {
  const items = useStore(itemsStore);
  const promoCode = useStore(promoCodeStore);
  const { data: products } = useProductCatalog();

  const handlePromoCodeBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      applyPromoCode(e.target.value);
    },
    [],
  );

  if (items.length === 0) {
    return (
      <p className="text-slate-400 italic text-sm">
        Your cart is empty. Add something from the catalog.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((item) => {
          const product = products?.find((p) => p.id === item.productId);
          return (
            <li
              key={item.productId}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-300">
                {product?.emoji} {product?.name} × {item.quantity}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <input
        defaultValue={promoCode ?? ""}
        onBlur={handlePromoCodeBlur}
        placeholder="Promo code (try SAVE10)"
        className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500 text-sm -outline-offset-2!"
      />

      <PricingBreakdown />

      <button
        type="button"
        onClick={() => stepStore.set("checkout")}
        className="w-full px-4 py-2 font-semibold rounded-lg bg-pink-600 hover:bg-pink-500 text-white cursor-pointer"
      >
        Proceed to checkout
      </button>
    </div>
  );
}
