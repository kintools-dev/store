import { createStore, derive } from "@kintools/store-core";

// Client-owned state only: what's in the cart, what step of checkout the user
// is on, and the draft promo code / zip. Product data, stock, pricing, and
// order history are server state and live in React Query instead, see
// src/queries/ and src/mutations/.

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

// The checkout state is split into primitive stores for each property,
// similar to Jotai/Tanstack Store.
export const stepStore = createStore<Step>(persistedState?.step || "cart");
export const itemsStore = createStore(persistedState?.items || []);
export const promoCodeStore = createStore(persistedState?.promoCode || null);
export const zipStore = createStore(persistedState?.zip || "");
export const lastOrderIdStore = createStore(
  persistedState?.lastOrderId || null,
);

derive((get) => ({
  step: get(stepStore),
  items: get(itemsStore),
  promoCode: get(promoCodeStore),
  zip: get(zipStore),
  lastOrderId: get(lastOrderIdStore),
})).subscribe(function () {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(this.get()));
});

// App logic is just simple functions that read/write the primitive stores.
// No atom wrappers.

export function setQuantity(
  productId: string,
  quantity: number,
) {
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
