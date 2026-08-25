---
description: "A checkout flow split along ownership lines: one withPlugins store for what the client owns (cart, step, promo code), TanStack Query for what the server owns."
---

# TanStack Query and One Fat Store

A checkout flow that splits state along ownership lines: Kin Store holds what
the _client_ owns (cart contents, current step, draft promo code), TanStack
Query holds what the _server_ owns (catalog, stock, computed pricing, order
history). This variant keeps the client half as one `withPlugins` store with
reducers; see
[TanStack Query and Primitive Stores](/store/examples/tanstack-query-primitive-stores)
for the same app built the other way, one `createStore` per field. Full source
in
[`examples/checkout-redux-style-react-query`](https://github.com/kintools-dev/store/tree/main/examples/checkout-redux-style-react-query).

## Why split state at all

Putting everything in one store, client and server data alike, means duplicating
whatever caching/refetching/invalidation logic a query library already solves,
or doing without it. Putting everything in the query library means treating
pending user input (an unconfirmed cart, a promo code being typed) as if it were
server data with a cache lifetime. Neither fits well. The split used here is: if
a page refresh should lose it, it's a query; if it should survive one, it's a
store.

## The store

```ts
// src/store.ts
import { withPlugins } from "@kintools/store-core";
import { devtools, persist } from "@kintools/store-plugins";

export type CartItem = { productId: string; quantity: number };
export type Step = "cart" | "checkout" | "confirmation";

export type CheckoutState = {
  step: Step;
  items: CartItem[];
  promoCode: string | null;
  zip: string;
  lastOrderId: string | null;
};

const initialState: CheckoutState = {
  step: "cart",
  items: [],
  promoCode: null,
  zip: "",
  lastOrderId: null,
};

export const checkoutStore = withPlugins(initialState)
  .use("persist", persist({ key: "checkout-react-query" }))
  .use(import.meta.env.DEV ? devtools() : {})
  .use({
    reducers: {
      setQuantity(state, productId: string, quantity: number) {
        const items = quantity <= 0
          ? state.items.filter((i) => i.productId !== productId)
          : state.items.some((i) => i.productId === productId)
          ? state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          )
          : [...state.items, { productId, quantity }];

        return { ...state, items };
      },
      applyPromoCode(state, code: string) {
        return { ...state, promoCode: code.trim() || null };
      },
      setZip(state, zip: string) {
        return { ...state, zip };
      },
      setStep(state, step: Step) {
        return { ...state, step };
      },
      completeOrder(_state, orderId: string) {
        return { ...initialState, step: "confirmation", lastOrderId: orderId };
      },
      startNewOrder() {
        return initialState;
      },
    },
  });
```

Nothing here is server data — no product list, no stock counts, no computed
totals. Just the cart the shopper is building and where they are in the flow,
all in one place. It's a plain module-level singleton (a client-only SPA has no
per-request isolation concern, unlike the
[Next.js example](/store/examples/nextjs)), and `persist` means an abandoned
cart is still there if they come back later.

## Feeding a store selection into a query key

`useCartPricing` is a **dependent query**: its inputs come straight out of Kin
Store, and its query key changes whenever they do, so React Query refetches
automatically as the cart changes. Pricing math (discounts, shipping thresholds,
tax) stays server-computed rather than duplicated on the client:

```ts
// src/queries/pricing.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "../store.ts";
import { calculatePricing } from "../api.ts";

export function useCartPricing() {
  const items = useSelector(checkoutStore, (s) => s.items);
  const promoCode = useSelector(checkoutStore, (s) => s.promoCode);
  const zip = useSelector(checkoutStore, (s) => s.zip);

  return useQuery({
    queryKey: ["pricing", items, promoCode, zip],
    queryFn: () => calculatePricing({ items, promoCode, zip }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  });
}
```

Each field needs its own `useSelector` call, since they all live inside the same
state object, one store subscription per slice a component cares about.

## Writing back from a mutation

The reverse direction: a mutation's `onSuccess` updates Kin Store (client state
moves to "confirmation") and invalidates a React Query cache (server state
refetches) in the same callback:

```ts
// src/mutations/submit-order.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkoutStore } from "../store.ts";
import { submitOrder } from "../api.ts";

export function useSubmitOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOrder,
    onSuccess: (order) => {
      // Client state moves to "confirmation" and forgets the cart.
      checkoutStore.dispatch.completeOrder(order.id);
      // Server state is invalidated so the order-history list refetches.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
```

## Driving the UI off the store

The top-level `step` selection is what decides which panel renders — no router,
no separate page per step:

```tsx
// src/App.tsx
import { useSelector } from "@kintools/store-react";
import { checkoutStore } from "./store.ts";
import { ProductCatalog } from "./components/ProductCatalog.tsx";
import { CartPanel } from "./components/CartPanel.tsx";
import { CheckoutForm } from "./components/CheckoutForm.tsx";
import { Confirmation } from "./components/Confirmation.tsx";

export function App() {
  const step = useSelector(checkoutStore, (s) => s.step);

  return (
    <div>
      {step === "cart" && (
        <>
          <ProductCatalog />
          <CartPanel />
        </>
      )}
      {step === "checkout" && <CheckoutForm />}
      {step === "confirmation" && <Confirmation />}
    </div>
  );
}
```
