---
description: "@kintools/store-react: useStore and useSelector hooks built on useSyncExternalStore, plus StoreProvider/useStoreContext for dependency injection."
---

# React Bindings

React bindings for `@kintools/store-core`.

## Install

`npm add @kintools/store-react` (or your package manager's equivalent); see
[Getting Started](/store/guide/getting-started#react) for every package
manager. It depends on and re-exports everything from `@kintools/store-core`,
so no need to install that separately.

## `useStore`

Subscribes a component to a store's whole state and re-renders on every state
change. Backed by `useSyncExternalStore`, safe for concurrent mode.

```tsx
import { createStore, useStore } from "@kintools/store-react";

const counter = createStore(0);

function Counter(): JSX.Element {
  const count = useStore(counter);
  return <div>{count}</div>;
}
```

Works with any store: a bare `createStore`, one extended with `.use()`, or a
`derive` store:

```tsx
const summary = derive((get) => ({
  greeting: `Hello, ${get(userStore).name}`,
  itemCount: get(cartStore).items.length,
}));

function Header() {
  const { greeting, itemCount } = useStore(summary);
  return (
    <header>
      {greeting}: {itemCount} items
    </header>
  );
}
```

To subscribe to a transformed value derived from the state, use `useSelector`
instead.

## `useSelector`

Selects a transformed value from the state and re-renders only when that value
changes, using an equality function to decide whether it actually changed.
Defaults to `shallowEqual`, which compares the value one level deep, safe even
when the selector returns a new object or array reference on every call (e.g.
`.filter()`, `.map()`, object literals):

```tsx
import { useSelector } from "@kintools/store-react";

// Only re-renders when `name` changes, not on every state update.
function UserName(): JSX.Element {
  const name = useSelector(userStore, (s) => s.name);
  return <span>{name}</span>;
}

function ActiveTodos(): JSX.Element {
  // shallowEqual (the default) prevents a re-render when the filtered
  // list's contents haven't changed, even though .filter() returns a new
  // array reference every call.
  const active = useSelector(
    todoStore,
    (s) => s.items.filter((item) => !item.completed),
  );

  return (
    <ul>
      {active.map((t) => <li key={t.id}>{t.title}</li>)}
    </ul>
  );
}
```

Pass a custom equality function for cases `shallowEqual` can't cover, like
tolerance-based comparisons:

```tsx
const progress = useSelector(
  downloadStore,
  (s) => s.bytesLoaded / s.totalBytes,
  (a, b) => Math.abs(a - b) < 0.001,
);
```

`shallowEqual` is also exported on its own, for use outside this hook.

## `StoreProvider` and `useStoreContext`

Inject a store via React context, useful for testing or SSR where you want to
avoid module-level singletons:

```tsx
import {
  createStore,
  StoreProvider,
  useStore,
  useStoreContext,
} from "@kintools/store-react";

const store = createStore(0).use({
  increment(n: number): void {
    this.set((s) => s + n);
  },
});

type Store = typeof store;

function App(): JSX.Element {
  return (
    <StoreProvider store={store}>
      <Counter />
    </StoreProvider>
  );
}

function Counter(): JSX.Element {
  const store = useStoreContext<Store>();
  const count = useStore(store);

  return <button onClick={() => store.increment(1)}>{count}</button>;
}
```

`useStoreContext` throws if called outside a `<StoreProvider>` tree.

## Actions are stable refs

Methods registered with `.use()` are stable references, they don't change
between renders. You can call them directly without subscribing:

```tsx
function AddButton() {
  // No useStore/useSelector needed: just call the method directly.
  return <button onClick={() => todoStore.addTodo("new item")}>Add</button>;
}
```
