import { useOrders } from "../queries/orders.ts";
import { money } from "../utils.ts";

export function OrderHistory() {
  const { data: orders } = useOrders();

  if (!orders || orders.length === 0) return null;

  return (
    <div className="mt-6 pt-6 border-t border-slate-800">
      <h2 className="text-sm font-semibold text-slate-200 mb-2">
        Recent orders
      </h2>
      <ul className="space-y-1 text-xs text-slate-400">
        {orders.map((order) => (
          <li key={order.id} className="flex justify-between">
            <span className="font-mono">{order.id}</span>
            <span>{money(order.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
