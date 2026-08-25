---
description: "derive composes one or more stores into a lazy, dependency-tracked, read-only view that recomputes only when a store it actually read changes."
---

# derive

Lazy, dependency-tracked, read-only views composed from one or more stores.

```ts
import { derive } from "@kintools/store-core";
```

`derive` computes a value from one or more stores reactively. Dependencies are
tracked automatically, no selector arrays, no manual wiring. The derived store
stays cold (no subscriptions, no caching) until something subscribes to it.

## Basic usage

```ts
import { createStore, derive } from "@kintools/store-core";

const user = createStore({ name: "Ada", role: "admin" });
const cart = createStore({ items: [] as string[], total: 0 });

// Reads from both stores. Recomputes only when either changes.
const summary = derive((get) => ({
  greeting: `Hello, ${get(user).name}`,
  itemCount: get(cart).items.length,
  total: get(cart).total,
}));

console.log(summary.get());
// { greeting: 'Hello, Ada', itemCount: 0, total: 0 }
```

`derive` returns a read-only store with `destroy`, `get`, and `subscribe`. It
has no `set`.

## Conditional dependencies

Only stores actually read during a recompute are subscribed. Branches that
aren't taken don't create subscriptions:

```ts
const isAdmin = derive((get) => get(user).role === "admin");

// When isAdmin is false, changes to adminStore don't trigger a recompute.
const view = derive((get) =>
  get(isAdmin) ? get(adminStore).dashboard : get(publicStore).feed
);
```

## Folding the previous value with `prev()`

Use `prev()` to fold the previous computed value into the next. An explicit type
annotation is required since TypeScript cannot infer `TState` from a
self-referential function:

```ts
const delta = createStore(1);
const total = derive<number>((get, prev) => (prev() ?? 0) + get(delta));

total.subscribe((get) => console.log(get()));
delta.set(5); // logs: 6
delta.set(3); // logs: 9
```

## Cleanup with `destroy()`

Call `destroy()` to unsubscribe from all source stores. Essential when a derived
store is created dynamically (e.g. in a component that unmounts):

```ts
const view = derive((get) =>
  get(isAdmin) ? get(adminStore).dashboard : get(publicStore).feed
);

// Later, when you're done.
view.destroy();
```

## Key properties

| Property         | Behavior                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Auto-tracked** | `get()` registers the dependency. No selector arrays needed.                            |
| **Lazy**         | Cold when no subscribers. Zero computation cost until something listens.                |
| **Conditional**  | Branches only subscribe to stores they actually read in a given pass.                   |
| **No paradigm**  | Just stores that talk to each other — no atoms, no signals, no graph concepts to learn. |

## With React

`derive` works directly with `useStore`:

```tsx
import { useStore } from "@kintools/store-react";

function Summary() {
  const { greeting, itemCount } = useStore(summary);
  return <div>{greeting} — {itemCount} items</div>;
}
```

See the [React](/store/react/) section for full bindings documentation.
