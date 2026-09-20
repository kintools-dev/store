import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "../store.ts";
import { useInventory } from "../queries/inventory.ts";
import { money } from "../utils.ts";
import type { Product } from "../api.ts";

export function ProductCard({ product }: { product: Product }) {
  const quantity = useSelector(
    checkoutStore,
    (s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0,
  );
  const { data: stockById } = useInventory([product.id]);
  const stock = stockById?.[product.id];

  const outOfStock = stock === 0;

  return (
    <div className="p-4 rounded-lg border border-slate-800 bg-slate-800/20 flex flex-col gap-2">
      <div className="text-3xl">{product.emoji}</div>
      <div className="font-semibold text-slate-100">{product.name}</div>
      <div className="text-slate-400">{money(product.price)}</div>
      <div className="text-xs text-slate-500">
        {stock === undefined
          ? "Checking stock…"
          : outOfStock
          ? "Out of stock"
          : `${stock} left`}
      </div>
      <button
        type="button"
        disabled={outOfStock}
        onClick={() =>
          checkoutStore.setQuantity(product.id, quantity + 1)}
        className="mt-auto px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium cursor-pointer"
      >
        {quantity > 0 ? `Add another (${quantity} in cart)` : "Add to cart"}
      </button>
    </div>
  );
}
