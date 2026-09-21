---
description: "createStore is Kin Store's one primitive: get, set, merge, and subscribe, plus .use() to add methods, namespacing, and lifecycle hooks when you need them."
---

# createStore

A value and six methods:

- `get`, `set`, `merge`, `subscribe` for a minimal start
- `use`, `destroy` for opt-in structure and teardown

```ts
import { createStore } from "@kintools/store-core";

type TodoState = { todos: string[]; status: "idle" | "loading" | "failed" };
const store = createStore({ todos: [], status: "idle" } as TodoState);
```

`createStore` holds any value. Logic can live in plain top-level functions with
no methods registered at all, or colocated on the store with `.use()`; see
[Structure](/store/guide/with-plugins).

## API

### `get()`

Reads the current state synchronously. Always returns the latest value.

```ts
const { todos } = store.get();
```

### `set(nextState)`

Accepts a new value or an updater function. Notifies all subscribers.

```ts
// Replace the whole state.
store.set({ todos: [], status: "idle" });

// Update via a function (avoids stale closures).
store.set((s) => ({ ...s, todos: [...s.todos, "new item"] }));
```

### `merge(partial)`

Shallow-merges a partial object into plain-object state.

Behaves like `set((s) => ({ ...s, ...partial }))`, or
`set((s) => ({ ...s, ...partial(s) }))` when given a function.

Plain-object state always notifies because the merge creates a new object. For
other state values, `partial` replaces the current state, and subscribers are
notified only when the two values are not the same by `Object.is`.

```ts
const store = createStore({ count: 0, name: "a" });

store.merge({ count: 1 });
console.log(store.get()); // { count: 1, name: "a" }

store.merge((s) => ({ count: s.count + 1 }));
console.log(store.get()); // { count: 2, name: "a" }
```

### `subscribe(listener)`

Registers a listener that is called on every state change. Returns a function
that unregisters it.

`this` inside a regular-function listener is bound to the store, so it can read
`this.get()` without a separate closure reference. An arrow-function listener
doesn't get `this` rebinding, but can read the store from its enclosing closure
instead.

```ts
const unsubscribe = store.subscribe(function (prevState) {
  console.log(prevState, "->", this.get());
});

unsubscribe(); // stop listening
```

### `destroy()`

Removes all listeners and runs every registered `onDestroy` hook. Safe to call
more than once; any other method throws after the first call.

```ts
store.destroy();
store.get(); // throws: "The store has been destroyed"
```

## `listenerWithSelector`

Wraps a listener so it only fires when a selected value from the state changes.

Useful for subscribing to a store outside of React without unnecessary re-runs.
The listener receives the previous selected value, and `this` inside it is the
store. Values are compared with `shallowEqual` by default; pass `{ equal }` to
override.

```ts
import { listenerWithSelector } from "@kintools/store-core";

const store = createStore({ count: 0, name: "Alice" });
const selectCount = (state: { count: number }) => state.count;

store.subscribe(
  listenerWithSelector(
    function (prevSelected, nextSelected) {
      console.log("count:", prevSelected, "->", nextSelected);
    },
    selectCount,
  ),
);

store.set({ count: 1, name: "Alice" }); // logs: count: 0 -> 1
store.set({ count: 1, name: "Bob" }); // no log, count didn't change
```

## When to keep it minimal

A bare `createStore`, no `.use()` calls, is the right choice when:

- You want the minimal API with no overhead.
- Logic is small enough to live in module-level functions.
- You're building a library or utility on top of Kin Store.

When you want methods colocated with the store, namespacing, or lifecycle hooks,
reach for `.use()`; see [Structure](/store/guide/with-plugins).
