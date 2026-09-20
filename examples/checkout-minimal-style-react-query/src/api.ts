// A fake backend. Every function here simulates a network round trip so the
// example behaves like a real API: latency, independently-changing stock, and
// server-computed pricing that the client must not duplicate.

export type Product = {
  id: string;
  name: string;
  price: number;
  emoji: string;
};

export type CartItemInput = { productId: string; quantity: number };

export type PricingResult = {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
};

export type Order = {
  id: string;
  items: CartItemInput[];
  total: number;
  placedAt: string;
};

const PRODUCTS: Product[] = [
  { id: "p1", name: "Mechanical Keyboard", price: 129, emoji: "⌨️" },
  { id: "p2", name: "Wireless Mouse", price: 49, emoji: "🖱️" },
  { id: "p3", name: "USB-C Hub", price: 39, emoji: "🔌" },
  { id: "p4", name: "Monitor Stand", price: 59, emoji: "🖥️" },
];

const inventory = new Map<string, number>([
  ["p1", 8],
  ["p2", 25],
  ["p3", 3],
  ["p4", 12],
]);

const PROMO_CODES: Record<string, number> = {
  SAVE10: 0.1,
  SAVE20: 0.2,
};

const orders: Order[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getProductCatalog(): Promise<Product[]> {
  await delay(300);
  return PRODUCTS;
}

export async function getInventory(
  ids: string[],
): Promise<Record<string, number>> {
  await delay(200);

  // Simulate other shoppers draining stock in the background.
  for (const id of ids) {
    const current = inventory.get(id);
    if (current !== undefined && current > 0 && Math.random() < 0.15) {
      inventory.set(id, current - 1);
    }
  }

  return Object.fromEntries(ids.map((id) => [id, inventory.get(id) ?? 0]));
}

export async function calculatePricing(input: {
  items: CartItemInput[];
  promoCode: string | null;
  zip: string | undefined;
}): Promise<PricingResult> {
  await delay(400);

  const subtotal = input.items.reduce((sum, item) => {
    const product = PRODUCTS.find((p) => p.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  const discountRate = input.promoCode
    ? PROMO_CODES[input.promoCode.toUpperCase()] ?? 0
    : 0;
  const discount = subtotal * discountRate;

  // Free shipping over $100, after discount. Requires a zip to quote at all.
  const shipping = !input.zip ? 0 : (subtotal - discount >= 100 ? 0 : 9.99);
  const tax = (subtotal - discount) * 0.08;

  return {
    subtotal,
    discount,
    shipping,
    tax,
    total: subtotal - discount + shipping + tax,
  };
}

export async function submitOrder(payload: {
  items: CartItemInput[];
  total: number;
}): Promise<Order> {
  await delay(500);

  for (const item of payload.items) {
    const current = inventory.get(item.productId) ?? 0;
    if (item.quantity > current) {
      throw new Error(
        `Not enough stock for product ${item.productId}: requested ${item.quantity}, available ${current}`,
      );
    }
  }

  for (const item of payload.items) {
    const current = inventory.get(item.productId) ?? 0;
    inventory.set(item.productId, current - item.quantity);
  }

  const order: Order = {
    id: `ord_${Date.now().toString(36)}`,
    items: payload.items,
    total: payload.total,
    placedAt: new Date().toISOString(),
  };
  orders.unshift(order);

  return order;
}

export async function getOrders(): Promise<Order[]> {
  await delay(200);
  return orders;
}
