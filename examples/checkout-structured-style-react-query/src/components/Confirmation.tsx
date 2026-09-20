import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "../store.ts";

export function Confirmation() {
  const lastOrderId = useSelector(checkoutStore, (s) => s.lastOrderId);

  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">✅</div>
      <p className="text-slate-200">
        Order <span className="font-mono text-pink-400">{lastOrderId}</span>
        {" "}
        placed!
      </p>
      <button
        type="button"
        onClick={() => checkoutStore.startNewOrder()}
        className="px-4 py-2 font-semibold rounded-lg bg-pink-600 hover:bg-pink-500 text-white cursor-pointer"
      >
        Start a new order
      </button>
    </div>
  );
}
