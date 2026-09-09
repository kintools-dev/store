---
description: "The persist plugin saves and hydrates store state to localStorage or any custom sync/async backend, with versioned migrations and selective persistence."
---

# persist

Persists and hydrates store state using a storage backend. Defaults to
`localStorage`. Any backend implementing `getItem` / `setItem` / `removeItem` is
accepted, including async ones.

## Basic usage

```ts
import { withPlugins } from "@kintools/store-core";
import { persist } from "@kintools/store-plugins";

const store = withPlugins({ count: 0 })
  .use({
    reducers: {
      increment: (state, n: number) => ({ count: state.count + n }),
    },
  })
  .use("persist", persist({ key: "my-counter" }));

store.dispatch.increment(1);
// State is automatically saved to localStorage['my-counter'].
// On the next page load, it is restored automatically.
```

## Persist a slice

```ts
.use('persist', persist({
  key: 'app',
  selector: (s) => ({ token: s.token }),
}))
```

## Schema versioning

```ts
.use('persist', persist({
  key: 'items',
  version: 1,
  migrate(stored: MyState, version: number): MyState {
    if (version === 0) return { items: stored.todos ?? [] };
    return stored;
  },
}))
```

## Custom async storage

```ts
const asyncStorage: PersistStorage = {
  async getItem(key: string): Promise<string | null> {
    return await myDB.get(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await myDB.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await myDB.delete(key);
  },
};

.use('persist', persist({ key: 'data', storage: asyncStorage }))
```

## SSR — skip auto-hydration

When rendering server-side, skip the automatic hydration and trigger it manually
on the client:

```ts
.use('persist', persist({ key: 'user', skipHydration: true }))

// On the client.
await store.persist.hydrate();
```

## Plugin methods

Once registered under a namespace (e.g. `'persist'`), the plugin exposes:

| Method                    | Description                                                           |
| ------------------------- | --------------------------------------------------------------------- |
| `hydrate()`               | Triggers a hydration; returns the in-progress hydration if one exists |
| `hasHydrated()`           | Returns `true` if at least one hydration has completed                |
| `hydrationComplete()`     | Returns a promise that resolves after the current or next hydration   |
| `clear()`                 | Removes the persisted value from storage                              |
| `onHydrationStart(cb)`    | Registers a callback that is called at the start of each hydration    |
| `onHydrationComplete(cb)` | Registers a callback that is called when a hydration completes        |

## Composing with history

After async hydration completes, call `history.rebase()` so undo doesn't step
back to the pre-hydration state:

```ts
const store = withPlugins({ items: [] as string[] })
  .use("persist", persist({ key: "items" }))
  .use("history", history())
  .use({ reducers: { add: (s, t: string) => ({ items: [...s.items, t] }) } });

await store.persist.hydrationComplete();
store.history.rebase();
```

## Options

| Option          | Type                         | Default        | Description                         |
| --------------- | ---------------------------- | -------------- | ----------------------------------- |
| `key`           | `string`                     | required       | Storage key                         |
| `storage`       | `PersistStorage`             | `localStorage` | Storage backend                     |
| `selector`      | `(state) => partial`         | full state     | Slice to persist                    |
| `version`       | `number`                     | `0`            | Schema version for migrations       |
| `migrate`       | `(stored, version) => state` | `undefined`    | Migration function                  |
| `skipHydration` | `boolean`                    | `false`        | Skip auto-hydration on registration |
