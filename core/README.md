# @kintools/store-core

[![JSR @kintools/store-core](https://jsr.io/badges/@kintools/store-core)](https://jsr.io/@kintools/store-core)
![License: MIT](https://img.shields.io/badge/License-MIT-166534?style=flat)
![Framework-agnostic](https://img.shields.io/badge/Framework--agnostic-166534?style=flat)
![Tiny footprint](https://img.shields.io/badge/Tiny%20footprint-166534?style=flat)
![100% type-safe](https://img.shields.io/badge/100%25%20type--safe-166534?style=flat)
![Zero dependencies](https://img.shields.io/badge/Zero%20dependencies-166534?style=flat)

One function, `createStore`, gets you `get`/`set`/`merge`/`subscribe` and,
through `.use()`, methods, namespacing, and lifecycle hooks. `derive` adds
reactive composition on top when you need it.

| Primitive     | Minified + Gzip |
| ------------- | ---------------- |
| `createStore` | 592 B             |
| `derive`      | 460 B             |

Zero dependencies, zero ceremony. Nothing to opt into beyond importing the
function you need.

## Design principles

### **Explicit over implicit**

No hidden merges, no auto-propagating destroy, no magic dependency graphs. If
something happens, you triggered it: a `set`/`merge` call, or a method you
called by name.

### **One function, opt-in capability**

`createStore` alone is `get`/`set`/`merge`/`subscribe`. `.use()` adds methods,
namespacing, and lifecycle hooks, and only the methods you register ever exist
on the store. `derive` adds reactive composition on top, only when you reach
for it.

### **Type safety by default**

Every method's arguments are fully inferred: no `any` or `unknown`, no manual
annotation at call sites. The type system is load-bearing, not decorative.

---

## Install

See [Installation](../README.md#install) in the root README.

---

## Step 1: Start simple

A store holds a value and notifies listeners when it changes.

```ts
import { createStore } from "@kintools/store-core";

type TodoState = { todos: string[]; status: "idle" | "loading" };

const todoStore = createStore({ todos: [], status: "idle" } as TodoState);

todoStore.merge((s) => ({ todos: [...s.todos, "Buy groceries"] }));
console.log(todoStore.get()); // { todos: ["Buy groceries"], status: "idle" }
```

Subscribe to react to changes. `this` inside a regular-function listener is
bound to the store, so it can read `this.get()` without a separate closure
reference:

```ts
const unsubscribe = todoStore.subscribe(function (prevState) {
  console.log("todos changed:", prevState, "->", this.get());
});

// Stop listening:
unsubscribe();
```

---

## Step 2: Compose stores

Use `derive` to compute values from multiple stores reactively. Dependencies
are tracked automatically: no selector arrays, no manual wiring, no hidden
graph. The derived store stays cold (no subscriptions, no caching) until
something subscribes to it.

```ts
import { createStore, derive } from "@kintools/store-core";

const userStore = createStore({ name: "Ada", role: "admin" });
const cartStore = createStore({ items: [] as string[], total: 0 });

// Reads from both stores. Recomputes only when either changes.
const summary = derive((get) => ({
  greeting: `Hello, ${get(userStore).name}`,
  itemCount: get(cartStore).items.length,
  total: get(cartStore).total,
}));

console.log(summary.get());
// { greeting: "Hello, Ada", itemCount: 0, total: 0 }
```

Conditional dependencies: only stores actually read during a recompute are
subscribed.

```ts
const isAdmin = derive((get) => get(userStore).role === "admin");

// When isAdmin is false, changes to `adminStore` do not trigger a recompute.
const view = derive((get) =>
  get(isAdmin) ? get(adminStore).dashboard : get(publicStore).feed
);
```

Use `prev()` to fold the previous computed value into the next (explicit type
required since TypeScript cannot infer `TState` from a self-referential
function):

```ts
const delta = createStore(1);
const total = derive<number>((get, prev) => (prev() ?? 0) + get(delta));

total.subscribe(function () {
  console.log(this.get());
});
delta.set(5); // 6
delta.set(3); // 9
```

---

## Step 3: Colocate logic

When the store grows, move logic inside it with `.use()`. Every method (and
`onActivated`/`onDestroy`) reaches the store through `this`, including
earlier methods and sibling methods registered by the same `.use()` call:

```ts
const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ todos: [...s.todos, text] }));
    },
    async fetchTodos(): Promise<void> {
      this.merge({ status: "loading" });
      const todos = await api.fetchTodos();
      this.set({ todos, status: "idle" });
    },
  });

todoStore.addTodo("Buy groceries");
await todoStore.fetchTodos();
```

`this` is bound via `Function.prototype.apply`, which only rebinds regular
functions. An arrow-function-valued method does not get this binding. Use
regular method syntax (`method() {}`) for anything that needs `this`.

---

## Step 4: Add plugins

Plugins extend the store with zero nesting. Each `.use()` adds one feature,
never wraps the previous one. A namespaced plugin's methods live at
`store.<namespace>.<name>`:

```ts
import { history, persist } from "@kintools/store-plugins";

const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use("persist", persist({ key: "todos" }))
  .use("history", history())
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ todos: [...s.todos, text] }));
    },
  });

await todoStore.persist.hydrate();
todoStore.addTodo("Buy groceries");
todoStore.history.undo();
```

Compare to Zustand's inside-out middleware nesting:

```ts
// Zustand: each middleware wraps the previous one, read inside-out.
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const useStore = create(
  devtools(
    persist(
      (set) => ({
        todos: [] as string[],
        status: "idle" as const,
        addTodo: (text: string) =>
          set((s) => ({ todos: [...s.todos, text] })),
      }),
      { name: "todos" },
    ),
  ),
);
```

---

## `listenerWithSelector`

Wraps a listener so it only fires when a selected value from the state changes.
Useful for subscribing to a store outside of React. The listener receives the
previous selected value, and `this` inside it is the store. Values are compared
with `shallowEqual` by default; pass `{ equal }` to override.

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
store.set({ count: 1, name: "Bob" }); // no log
```

---

## Writing a plugin

A `StorePlugin` is a plain object of methods plus optional `onActivated`/
`onDestroy` lifecycle hooks, no factory function, no `store` parameter.
Plugins can be shared and composed independently of the store they are
applied to.

### Lifecycle hooks

`onActivated` runs immediately after the plugin's methods are attached to the
store; `onDestroy` runs when `store.destroy()` is called, in registration
order, before the store is marked destroyed:

```ts
const store = createStore({ count: 0 }).use({
  onActivated() {
    console.log("initial state:", this.get());
  },
  onDestroy() {
    console.log("final state:", this.get());
  },
  increment(amount: number): void {
    this.merge((s) => ({ count: s.count + amount }));
  },
});
```

### Internal state

Plugin-internal bookkeeping (flags, counters, listener sets) lives in the
factory's closure variables, not `TState`.

### Plugin factory functions

To write a reusable, shareable plugin (like the official `persist` and
`history` plugins), wrap it in a generic factory function. The type
parameters mirror the store's accumulated shape at the point the plugin is
applied. A plain object can't itself carry `TState` for inference (it's only
visible inside the `ThisType` marker, which inference doesn't look through),
so the function's declared return type includes the `StorePluginFactory`
union member purely so `TState` infers correctly at the `.use()` call site;
the function still just returns a plain object:

```ts
import type { NestedMethods, StorePlugin } from "@kintools/store-core";

type LoggerOptions = {
  prefix?: string;
};

type LoggerMethods = {
  getLogs(): string[];
};

export function logger<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(
  options: LoggerOptions = {},
): StorePlugin<TState, TStoreMethods, TNamespace, LoggerMethods> {
  const prefix = options.prefix ?? "→";
  const logs: string[] = [];

  return {
    onActivated() {
      this.subscribe((prevState) => {
        const entry = `${prefix} ${JSON.stringify(prevState)} -> ${
          JSON.stringify(this.get())
        }`;
        logs.push(entry);
        console.log(entry);
      });
    },
    getLogs: () => [...logs],
  };
}
```

To constrain which stores the plugin can be applied to, tighten
`TStoreMethods`. This only works if the plugin contributes at least one real
(non-optional) method: `PluginBody`'s `ThisType` marker carries no structural
members of its own, so a plugin with *only* `onActivated`/`onDestroy` (both
optional) is trivially compatible with any store regardless of
`TStoreMethods`: there's nothing required for TypeScript to check. A real
method gives it something to check:

```ts
// Requires a `history` plugin to already be registered
export function undoOnEscape<
  TState,
  TStoreMethods extends NestedMethods & { history: { undo(): boolean } },
  TNamespace extends string | undefined,
>(): StorePlugin<TState, TStoreMethods, TNamespace, { armEscapeHandler(): void }> {
  return {
    armEscapeHandler() {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.history.undo();
      });
    },
  };
}

const store = createStore({ count: 0 })
  .use("history", history())
  .use(undoOnEscape()); // OK: history is present
store.armEscapeHandler();

createStore({ count: 0 }).use(undoOnEscape()); // type error: history not registered
```
