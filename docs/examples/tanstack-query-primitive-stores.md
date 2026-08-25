---
description: "The same TanStack Query checkout flow, built with one createStore per client-owned field instead of a single withPlugins store, merged with derive."
---

# TanStack Query and Primitive Stores

The same checkout flow as
[TanStack Query and One Fat Store](/store/examples/tanstack-query-fat-store),
built the other way: instead of one `withPlugins` store holding the whole client
state, each field gets its own `createStore`, and a `derive` store merges them
for persistence. Kin Store still holds what the _client_ owns (cart contents,
current step, draft promo code); TanStack Query still holds what the _server_
owns (catalog, stock, computed pricing, order history). Full source in
[`examples/checkout-jotai-style-react-query`](https://github.com/kintools-dev/store/tree/main/examples/checkout-jotai-style-react-query).

## Why split state at all

Putting everything in one store, client and server data alike, means duplicating
whatever caching/refetching/invalidation logic a query library already solves,
or doing without it. Putting everything in the query library means treating
pending user input (an unconfirmed cart, a promo code being typed) as if it were
server data with a cache lifetime. Neither fits well. The split used here is: if
a page refresh should lose it, it's a query; if it should survive one, it's a
store.

## The stores

```ts
// src/stores.ts
import { createStore, derive } from "@kintools/store-core";

export type CartItem = { productId: string; quantity: number };
export type Step = "cart" | "checkout" | "confirmation";

export type CheckoutState = {
  step: Step;
  items: CartItem[];
  promoCode: string | null;
  zip: string;
  lastOrderId: string | null;
};

const PERSIST_KEY = "checkout-react-query";

const persistedState = JSON.parse(
  localStorage.getItem(PERSIST_KEY) || "null",
) as CheckoutState | null;

// One store per field, rather than one store for the whole client state.
export const stepStore = createStore<Step>(persistedState?.step || "cart");
export const itemsStore = createStore(persistedState?.items || []);
export const promoCodeStore = createStore(persistedState?.promoCode || null);
export const zipStore = createStore(persistedState?.zip || "");
export const lastOrderIdStore = createStore(
  persistedState?.lastOrderId || null,
);

// derive merges the fields back into one view to persist as a single value.
derive((get) => ({
  step: get(stepStore),
  items: get(itemsStore),
  promoCode: get(promoCodeStore),
  zip: get(zipStore),
  lastOrderId: get(lastOrderIdStore),
})).subscribe((get) => {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(get()));
});

// App logic is plain functions that read and write the primitive stores
// directly — no reducers, no dispatch.
export function setQuantity(productId: string, quantity: number) {
  let v = itemsStore.get();
  v = quantity <= 0
    ? v.filter((i) => i.productId !== productId)
    : v.some((i) => i.productId === productId)
    ? v.map((i) => i.productId === productId ? { ...i, quantity } : i)
    : [...v, { productId, quantity }];

  itemsStore.set(v);
}

export function applyPromoCode(code: string) {
  promoCodeStore.set(code.trim() || null);
}

export function completeOrder(orderId: string) {
  itemsStore.set([]);
  promoCodeStore.set(null);
  zipStore.set("");
  stepStore.set("confirmation");
  lastOrderIdStore.set(orderId);
}

export function startNewOrder() {
  stepStore.set("cart");
  lastOrderIdStore.set(null);
}
```

The `persist` plugin doesn't apply here the way it does in the fat-store
version: it attaches to a single mutable store via `withPlugins`, and there
isn't one, just five independent stores plus a read-only `derive` view over
them. So persistence is hand-rolled instead: `derive` produces the merged
snapshot, and `subscribe` writes it to `localStorage` on every change. The
`persist` plugin's schema versioning, migration, and async-storage support
aren't available for free here; they'd need to be written by hand too, if
needed.

## Reading a field

Because each field already lives in its own store, a component that only cares
about one field just subscribes to that one, no selector required:

```tsx
// src/App.tsx
import { useStore } from "@kintools/store-react";
import { stepStore } from "./stores.ts";

export function App() {
  const step = useStore(stepStore);
  // ...
}
```

Compare to the fat-store version's `useSelector(checkoutStore, (s) => s.step)` —
the selector's job (narrowing a subscription to one field) is already done by
the store boundary itself.

## Feeding stores into a query key

Same dependent-query shape as the fat-store version, just reading from three
separate stores instead of selecting three fields off of one:

```ts
// src/queries/pricing.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useStore } from "@kintools/store-react";
import { itemsStore, promoCodeStore, zipStore } from "../stores.ts";
import { calculatePricing } from "../api.ts";

export function useCartPricing() {
  const items = useStore(itemsStore);
  const promoCode = useStore(promoCodeStore);
  const zip = useStore(zipStore);

  return useQuery({
    queryKey: ["pricing", items, promoCode, zip],
    queryFn: () => calculatePricing({ items, promoCode, zip }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  });
}
```

## Writing back from a mutation

`completeOrder` is a plain function, not a dispatched reducer, so a mutation's
`onSuccess` just calls it directly:

```ts
// src/mutations/submit-order.ts
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
  });
}
```
