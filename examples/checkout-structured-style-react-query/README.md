# Checkout + React Query: Kin Store (Structured style)

Demonstrates splitting state between **Kin Store** (client-owned) and
**TanStack React Query** (server-owned) in a checkout flow, rather than
putting everything in one store.

- **Client state** (`src/store.ts`, a `createStore` store with `persist`):
  cart line items, the current checkout step, the promo-code and zip drafts.
  It's local, instant, and survives a refresh.
- **Server state** (`src/queries/`, `src/mutations/`): the product catalog,
  live inventory (revalidated on an interval), the computed price breakdown,
  and order history. It's fetched, cached, and invalidated by React Query.

The seam between the two: [`useCartPricing`](src/queries/pricing.ts) is a
*dependent* query: it reads its inputs (cart items, promo code, zip) with
`useStore` from the Kin Store, and uses them as its query key. Editing the
cart in the store automatically triggers a re-fetch of the
server-authoritative price. [`useSubmitOrder`](src/mutations/submit-order.ts)
does the reverse: on success it resets the Kin Store (client state moves to
"confirmation") and invalidates the `orders` query (server state refetches).

`src/api.ts` is a fake backend (no real network calls) that simulates
latency and independently-changing stock, so the example behaves like a real
app without needing a server.

## Stack

[Deno](https://deno.com) · Vite · React · TanStack React Query · Kin Store ·
TypeScript · Tailwind CSS

## Running

Requires Deno v2 or later.

```bash
deno task dev
```

## Building

```bash
deno task build      # production bundle → dist/
deno task preview    # preview the production build locally
deno task serve      # serve dist/ with a static file server
```
