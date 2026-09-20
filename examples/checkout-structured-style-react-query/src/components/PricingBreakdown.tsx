import { useCartPricing } from "../queries/pricing.ts";
import { money } from "../utils.ts";

export function PricingBreakdown() {
  const { data: pricing, isFetching } = useCartPricing();

  if (!pricing) return null;

  return (
    <div
      className={`text-sm text-slate-400 space-y-1 transition-opacity ${isFetching ? "opacity-50" : ""}`}
    >
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{money(pricing.subtotal)}</span>
      </div>
      {pricing.discount > 0 && (
        <div className="flex justify-between text-emerald-400">
          <span>Discount</span>
          <span>−{money(pricing.discount)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>Shipping</span>
        <span>{pricing.shipping === 0 ? "Free" : money(pricing.shipping)}</span>
      </div>
      <div className="flex justify-between">
        <span>Tax</span>
        <span>{money(pricing.tax)}</span>
      </div>
      <div className="flex justify-between text-slate-100 font-semibold text-base pt-1 border-t border-slate-800">
        <span>Total</span>
        <span>{money(pricing.total)}</span>
      </div>
    </div>
  );
}
