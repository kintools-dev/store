---
description: "How to write a StorePlugin: methods, internal state, lifecycle hooks, this-binding, reusable factory functions, and constraining which stores a plugin targets."
---

# Writing Plugins

A `StorePlugin` is a plain object of methods plus optional `onActivated` and
`onDestroy` lifecycle hooks. Plugins can be shared and composed independently
of the store they are applied to.

## Methods and internal state

Every method (and `onActivated`/`onDestroy`) reaches the store through `this`,
typed as the full store including this plugin's own methods and every earlier
plugin's:

```ts
import type { StorePlugin } from "@kintools/store-core";

type State = { count: number };

type CounterMethods = {
  increment(amount: number): void;
  incrementTwice(amount: number): void;
};

const counter: StorePlugin<State, {}, undefined, CounterMethods> = {
  onActivated() {
    console.log("activated with", this.get().count);
  },
  increment(amount: number): void {
    this.merge((s) => ({ count: s.count + amount }));
  },
  incrementTwice(amount: number): void {
    this.increment(amount);
    this.increment(amount);
  },
};

const store = createStore({ count: 0 }).use(counter);
```

The explicit `CounterMethods` type argument is needed here: without it, `TPluginMethods` defaults to `{}`, and TypeScript rejects `increment`/`incrementTwice` as excess properties. Assigning the plugin inline to `.use({...})` instead lets `TPluginMethods` infer from the literal, without needing this annotation at all; reach for a standalone typed constant only when you need to export or reuse the plugin object itself.

`this` is bound via `Function.prototype.apply`, which only rebinds regular
functions. Use regular method syntax (`method() {}`), not arrow functions,
for anything that needs `this`.

Plugin-internal bookkeeping, flags, counters, listener sets, lives in the
factory's closure variables, not `TState`.

## Lifecycle hooks

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

<Container type="warning" title="Avoid patching the store object">

Every method and lifecycle hook has full access to the store via `this`, but
avoid mutating or monkey-patching the store object itself. Declare
capabilities through named methods instead; that keeps plugin contracts
explicit and collision-detectable (`.use()` throws if a name is already
taken).

</Container>

## Reusable plugin factories

To write a shareable plugin (like the official `persist` and `history`), wrap
it in a generic factory function. The type parameters mirror the store's
accumulated shape at the point the plugin is applied. A plain object can't
itself carry `TState` for inference (it's only visible inside the `ThisType`
marker, which inference doesn't look through), so the function's declared
return type includes the `StorePluginFactory` union member purely so `TState`
infers correctly at the `.use()` call site; the function still just returns a
plain object.

A plugin can observe every state change from inside `this.subscribe()`, no
separate middleware concept needed, the way the `logger` factory below does:

```ts
import type { NestedMethods, StorePlugin } from "@kintools/store-core";

type LoggerOptions = { prefix?: string };
type LoggerMethods = { getLogs(): string[] };

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

## Constraining which stores a plugin can target

Tighten `TStoreMethods` to require certain plugins to be registered first.
TypeScript errors if the dependency is missing. This only works if the plugin
contributes at least one real (non-optional) method: `PluginBody`'s
`ThisType` marker carries no structural members of its own, so a plugin with
*only* `onActivated`/`onDestroy` (both optional) is trivially compatible with
any store regardless of `TStoreMethods`, there's nothing required for
TypeScript to check. A real method gives it something to check:

```ts
// Requires a `history` plugin to already be registered.
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
