---
description: "The immer plugin lets methods (and set) mutate an Immer draft directly instead of returning a new state object."
---

# immer

Write methods (and `set` calls) as [Immer](https://immerjs.github.io/immer/)
draft mutations instead of returning new state objects.

## Basic usage

```ts
import { createStore } from "@kintools/store-core";
import { immer } from "@kintools/store-plugins";

const store = createStore({ count: 0, items: [] as string[] }).use(
  immer({
    increment(amount: number): void {
      this.set((draft) => {
        draft.count += amount;
      });
    },
    addItem(item: string): void {
      this.set((draft) => {
        draft.items.push(item);
      });
    },
    reset(): void {
      this.set((draft) => {
        draft.count = 0;
        draft.items = [];
      });
    },
  }),
);

store.increment(5);
store.addItem("hello");
store.reset();
```

`immer(plugin)` wraps a plugin written against an `ImmerStore`, identical to
a normal store except `set` accepts a recipe `(draft) => void` instead of a
full state replacement, and returns a standard `StorePlugin` ready for
`store.use()`. Every method (and `onActivated`/`onDestroy`) is individually
wrapped so `this` resolves to the Immer-flavored store no matter how it's
reached: externally, or via a sibling/earlier-plugin call through `this`.

## With namespacing

`immer` can also be applied as a namespaced plugin:

```ts
const store = createStore({ todos: [] as string[] }).use(
  "todos",
  immer({
    add(text: string): void {
      this.set((draft) => {
        draft.todos.push(text);
      });
    },
    clear(): void {
      this.set((draft) => {
        draft.todos = [];
      });
    },
  }),
);

store.todos.add("hello");
store.todos.clear();
```

## Note on type inference

Because Immer mutates a draft in-place (void return), methods written with
`immer` do not need to return a value. TypeScript fully infers argument types
from the method signature.
