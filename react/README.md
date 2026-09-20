# @kintools/store-react

[![JSR @kintools/store-react](https://jsr.io/badges/@kintools/store-react)](https://jsr.io/@kintools/store-react)
![License: MIT](https://img.shields.io/badge/License-MIT-166534?style=flat)

React bindings for `@kintools/store-core`, built on `useSyncExternalStore`. Also
re-exports everything from core.

## Install

```sh [npm]
npm add @kintools/store-react
```

```sh [pnpm]
pnpm add @kintools/store-react
```

```sh [deno]
deno add jsr:@kintools/store-react
```

## Usage

`useStore` subscribes to the whole state. `useSelector` subscribes to a selected
value and re-renders only when it changes (compared with `shallowEqual` by
default). `StoreProvider` and `useStoreContext` inject a store through context.

```tsx
import { createStore, useSelector, useStore } from "@kintools/store-react";

const store = createStore({ count: 0, name: "Ada" });

function Name() {
  const name = useSelector(store, (s) => s.name);
  return <span>{name}</span>;
}

function Counter() {
  const { count } = useStore(store);
  return (
    <button onClick={() => store.merge({ count: count + 1 })}>{count}</button>
  );
}
```

## Docs

[kintools.dev/store/react](https://kintools.dev/store/react)
