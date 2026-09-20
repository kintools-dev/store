import { createStore } from "@kintools/store-core";
import { devtools, persist } from "@kintools/store-plugins";

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

const initialState: CheckoutState = {
  step: "cart",
  items: [],
  promoCode: null,
  zip: "",
  lastOrderId: null,
};

export const checkoutStore = createStore(initialState)
  .use("persist", persist({ key: "checkout-react-query" }))
  .use(import.meta.env.DEV ? devtools() : {})
  .use({
    setQuantity(productId: string, quantity: number): void {
      const state = this.get();
      const items = quantity <= 0
        ? state.items.filter((i) => i.productId !== productId)
        : state.items.some((i) => i.productId === productId)
        ? state.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        )
        : [...state.items, { productId, quantity }];

      this.merge({ items });
    },
    applyPromoCode(code: string): void {
      this.merge({ promoCode: code.trim() || null });
    },
    setZip(zip: string): void {
      this.merge({ zip });
    },
    setStep(step: Step): void {
      this.merge({ step });
    },
    completeOrder(orderId: string): void {
      this.set({
        ...initialState,
        step: "confirmation",
        lastOrderId: orderId,
      });
    },
    startNewOrder(): void {
      this.set(initialState);
    },
  });
