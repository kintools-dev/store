---
description: "@kintools/store-react: useStore and useSelector hooks built on useSyncExternalStore, plus StoreProvider/useStoreContext for dependency injection."
---

# React

React bindings for `@kintools/store-core`.

## Install

<CodeGroup>

<CodeGroupItem label="npm">

```sh
npm add @kintools/store-react
```

</CodeGroupItem>

<CodeGroupItem label="pnpm">

```sh
pnpm add @kintools/store-react
```

</CodeGroupItem>

<CodeGroupItem label="deno">

```sh
deno add jsr:@kintools/store-react
```

</CodeGroupItem>

`@kintools/store-react` depends on and re-exports everything from
`@kintools/store-core`, so no need to install it separately.

</CodeGroup>

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

Works with any store, `createStore`, `withPlugins`, or `derive`:

```tsx
const summary = derive((get) => ({
  greeting: `Hello, ${get(userStore).name}`,
  itemCount: get(cartStore).items.length,
}));

function Header() {
  const { greeting, itemCount } = useStore(summary);
  return (
    <header>
      {greeting} — {itemCount} items
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
  StoreProvider,
  useStore,
  useStoreContext,
  withPlugins,
} from "@kintools/store-react";

const store = withPlugins(0).use({
  reducers: {
    increment: (state, n: number) => state + n,
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

  return <button onClick={() => store.dispatch.increment(1)}>{count}</button>;
}
```

`useStoreContext` throws if called outside a `<StoreProvider>` tree.

## Actions are stable refs

Methods and dispatch functions on a `withPlugins` store are stable references,
they don't change between renders. You can call them directly without
subscribing:

```tsx
function AddButton() {
  // No useStore/useSelector needed — just call the method directly.
  return <button onClick={() => todoStore.addTodo("new item")}>Add</button>;
}
```
