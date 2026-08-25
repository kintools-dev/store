---
description: "Guided, runnable examples: Next.js SSR, splitting client and server state with TanStack Query as one store or many, and cross-tab sync recipes."
---

# Guided Examples

Full, runnable apps in the
[repository](https://github.com/kintools-dev/store/tree/main/examples), walked
through here for the parts that are specific to Kin Store.

| Guide                                                                                  | What it covers                                                                                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Next.js](/store/examples/nextjs)                                                      | SSR-safe store instantiation, `StoreProvider`, and `persist` with manual hydration.                                         |
| [TanStack Query and One Fat Store](/store/examples/tanstack-query-fat-store)           | Splitting client-owned state (Kin Store) from server-owned state (React Query), as a single `withPlugins` store.            |
| [TanStack Query and Primitive Stores](/store/examples/tanstack-query-primitive-stores) | The same split, with each field as its own `createStore` merged by `derive`.                                                |
| [Cross-Tab Sync](/store/examples/cross-tab-sync)                                       | Recipes for syncing store state across open tabs, with `persist` and the `storage` event, or with `BroadcastChannel` alone. |
