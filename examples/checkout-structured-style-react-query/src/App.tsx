import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "./store.ts";
import { StepBar } from "./components/StepBar.tsx";
import { ProductCatalog } from "./components/ProductCatalog.tsx";
import { CartPanel } from "./components/CartPanel.tsx";
import { CheckoutForm } from "./components/CheckoutForm.tsx";
import { Confirmation } from "./components/Confirmation.tsx";
import { OrderHistory } from "./components/OrderHistory.tsx";

export function App() {
  const step = useSelector(checkoutStore, (s) => s.step);

  return (
    <div className="max-w-5xl mx-auto my-12 px-4">
      <div className="p-6 bg-gray-900 rounded-xl border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100">Checkout</h1>
          <StepBar />
        </div>

        {step === "cart" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-400 mb-2">
                Catalog
              </h2>
              <ProductCatalog />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-400 mb-2">
                Cart
              </h2>
              <CartPanel />
            </div>
          </div>
        )}

        {step === "checkout" && <CheckoutForm />}
        {step === "confirmation" && <Confirmation />}

        <OrderHistory />
      </div>
      <p className="mt-6 text-center text-slate-400 text-sm">
        Kin Store example: checkout-react-query · Kin Store (client state) +
        TanStack React Query (server state)
      </p>
    </div>
  );
}
