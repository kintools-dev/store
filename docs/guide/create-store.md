---
description: "createStore is Kin Store's minimal primitive, a value plus get, set, and subscribe, with no dispatch, no action types, and no plugins required."
---

# createStore

The irreducible floor. A value and three methods.

```ts
import { createStore } from "@kintools/store-core";
```

## Basic usage

```ts
type TodoState = { todos: string[]; status: "idle" | "loading" | "failed" };

const store = createStore({ todos: [], status: "idle" } as TodoState);
```

`createStore` holds any value and returns an object with three methods: `get`,
`set`, and `subscribe`. Logic lives in plain top-level functions — no dispatch,
no action types.

```ts
function addTodo(text: string): void {
  store.set((s) => ({ ...s, todos: [...s.todos, text] }));
}

async function fetchTodos(): Promise<void> {
  store.set((s) => ({ ...s, status: "loading" }));
  try {
    const todos = await api.getTodos();
    store.set({ todos, status: "idle" });
  } catch {
    store.set((s) => ({ ...s, status: "failed" }));
  }
}

addTodo("Hello world");
console.log(store.get()); // { todos: ['Hello world'], status: 'idle' }
```

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

// Merge via updater (the idiomatic pattern — avoids stale closures).
store.set((s) => ({ ...s, todos: [...s.todos, "new item"] }));
```

### `subscribe(listener)`

Fires on every state change. Returns an unsubscribe function.

```ts
const unsubscribe = store.subscribe((get, prevState) => {
  console.log(prevState, "->", get());
});

// Stop listening.
unsubscribe();
```

The listener receives `get` (a getter, not the value itself) and `prevState`
(the state before the change). Using a getter allows
[`derive`](/store/guide/derive) to stay lazy: a derived store defers
recomputation until something actually calls its `get()`, instead of recomputing
eagerly on every upstream change.

## `listenerWithSelector`

Wraps a listener so it only fires when a selected slice of the state changes.
Useful for subscribing to a store outside of React without unnecessary re-runs.

```ts
import { listenerWithSelector } from "@kintools/store-core";

const store = createStore({ count: 0, name: "Alice" });

store.subscribe(
  listenerWithSelector(
    (getSlice, prevSlice) => console.log("count:", prevSlice, "->", getSlice()),
    (state) => state.count,
  ),
);

store.set({ count: 1, name: "Alice" }); // logs: count: 0 -> 1
store.set({ count: 1, name: "Bob" }); // no log — count didn't change
```

## When to use createStore

`createStore` is the right choice when:

- You want the minimal API with no overhead
- Logic is small enough to live in module-level functions
- You're building a library or utility on top of Kin Store

When you need methods colocated with the store, a dispatch pipeline, or
middleware, reach for [`withPlugins`](/store/guide/with-plugins).
