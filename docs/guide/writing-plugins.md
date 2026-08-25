---
description: "How to write a StorePlugin: reducers and internal state, middleware, methods, and the onActivated/onDestroy lifecycle hooks, for your own Kin Store plugins."
---

# Writing Plugins

A `StorePlugin` is a plain object with any combination of `reducers`,
`middleware`, `methods`, `onActivated`, and `onDestroy`. Plugins can be shared
and composed independently of the store they are applied to.

## Reducers and internal state

All changes to the store's primary state (`TState`) should go through a reducer,
not `set`. Reducers travel through the full middleware pipeline, they can be
logged, traced, or canceled by any middleware in the chain:

```ts
// Observe every reducer call, including ones from plugins:
((ctx, next) => {
  console.log(ctx.reducer.name); // "history._restore", "persist._restore", ...
  return next();
});

// Cancel a specific reducer under a condition:
((ctx, next) => {
  if (ctx.reducer.name === "persist._restore" && !auth.isReady()) {
    return CANCELED;
  }
  return next();
});
```

`set` bypasses the pipeline by design — use it when you need a hard reset that
must survive middleware that would otherwise cancel it, or when traceability is
not a goal.

Plugin-internal bookkeeping — flags, counters, listener sets — lives in closure
variables, not `TState`.

## Middleware

A plugin can include middleware that runs on every dispatch:

```ts
import { withPlugins } from "@kintools/store-core";
import type { StorePlugin } from "@kintools/store-core";

type State = { count: number };

const loggingPlugin: StorePlugin<State> = {
  middleware: () => (ctx, next) => {
    console.log("->", ctx.reducer.name, ctx.reducer.args);
    const result = next();
    console.log("<-", result);
    return result;
  },
};

const store = withPlugins({ count: 0 }).use(loggingPlugin);
```

## Lifecycle hooks

`onActivated` runs immediately after the plugin is registered; `onDestroy` runs
when `store.destroy()` is called:

```ts
const store = withPlugins({ count: 0 }).use({
  onActivated: (store) => {
    console.log("initial state:", store.get());
  },
  onDestroy: (store) => {
    console.log("final state:", store.get());
  },
});
```

<Container type="warning" title="Avoid patching the store object">

`onActivated`, `onDestroy`, and `methods` all receive the full store API, but
avoid mutating or monkey-patching the store object itself. Declare capabilities
through `methods` and `reducers` instead — that keeps plugin contracts explicit
and collision-detectable.

</Container>

## Dispatching from methods

Use `getPluginDispatch` to call a plugin's own reducers from `methods`,
regardless of whether the plugin is namespaced:

```ts
import { getPluginDispatch } from "@kintools/store-core";

methods: (store, { namespace }) => {
  const dispatch = getPluginDispatch(store, namespace);
  return {
    undo(): void { dispatch._restore(previousState); },
  };
},
```

## Reusable plugin factories

To write a shareable plugin (like the official `persist` and `history`), wrap it
in a generic factory function. The four type parameters mirror the store's
accumulated shape at the point the plugin is applied:

```ts
import type {
  NestedMethods,
  NestedReducers,
  StorePlugin,
} from "@kintools/store-core";

type LoggerOptions = { prefix?: string };
type LoggerMethods = { getLogs(): string[] };

export function logger<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(
  options: LoggerOptions = {},
): StorePlugin<
  TState,
  TStoreReducers,
  TStoreMethods,
  TNamespace,
  {},
  LoggerMethods
> {
  const prefix = options.prefix ?? "→";
  const logs: string[] = [];

  return {
    middleware: () => (ctx, next) => {
      const entry = `${prefix} ${String(ctx.reducer.name)}`;
      logs.push(entry);
      console.log(entry, ctx.reducer.args);
      return next();
    },
    methods: () => ({
      getLogs: () => [...logs],
    }),
  };
}
```

## Naming a plugin's own store type

`methods`, `onActivated`, and `onDestroy` each receive `store` already typed
with this plugin's own reducers merged in (and, outside of `methods`, its own
methods too, see [Dispatching from methods](#dispatching-from-methods) for why
`methods` can't see its own plugin's methods). Inline callbacks get this for
free from `StorePlugin`'s own signatures. If you factor logic out into a
standalone helper function instead, name that store type with `PluginStore`
rather than reconstructing it from `StoreWithPlugins` yourself:

```ts
import type {
  NestedMethods,
  NestedReducers,
  PluginStore,
  StorePlugin,
} from "@kintools/store-core";

type CounterReducers<TState> = { bump: (state: TState) => TState };

function logAndBump<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(
  store: PluginStore<
    TState,
    TStoreReducers,
    TStoreMethods,
    TNamespace,
    CounterReducers<TState>
  >,
): void {
  console.log("state before bump:", store.get());
  store.dispatch.bump();
}

export function counter<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(): StorePlugin<
  TState,
  TStoreReducers,
  TStoreMethods,
  TNamespace,
  CounterReducers<TState>
> {
  return {
    reducers: { bump: (state) => state },
    methods: (store) => ({ logAndBump: () => logAndBump(store) }),
  };
}
```

## Constraining which stores a plugin can target

Tighten `TStoreMethods` or `TStoreReducers` to require certain plugins to be
registered first. TypeScript will error if the dependency is missing:

```ts
// Requires a `history` plugin to already be registered.
export function undoOnEscape<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods & { history: { undo(): boolean } },
  TNamespace extends string | undefined,
>(): StorePlugin<TState, TStoreReducers, TStoreMethods, TNamespace> {
  return {
    onActivated(store) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") store.history.undo();
      });
    },
  };
}

const store = withPlugins({ count: 0 })
  .use("history", history())
  .use(undoOnEscape()); // ✓ — history is present

withPlugins({ count: 0 }).use(undoOnEscape()); // ✗ — type error: history not registered
```
