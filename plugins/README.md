# @kintools/store-plugins

Official plugins for `@kintools/store-core`.

| Plugin     | Export                          | Description                                        |
| ---------- | -------------------------------- | --------------------------------------------------- |
| `devtools` | `devtools` from `./devtools.ts`  | Connect to the Redux DevTools extension              |
| `history`  | `history` from `./history.ts`    | Undo / redo / reset                                  |
| `immer`    | `immer` from `./immer.ts`        | Write methods as Immer draft mutations               |
| `persist`  | `persist` from `./persist.ts`    | Persist state to storage                             |

---

## `devtools`

Connects a store to the
[Redux DevTools Extension](https://github.com/reduxjs/redux-devtools). Every
state change is forwarded to the extension, and panel interactions are applied
back to the store. No namespace is needed because the plugin adds no public
methods.

```ts
import { devtools } from "@kintools/store-plugins";

const store = createStore({ count: 0 })
  .use({
    increment(n: number): void {
      this.merge((s) => ({ count: s.count + n }));
    },
  })
  .use(devtools({ name: "counter" }));
```

The plugin is a no-op when the extension is absent, so it is safe to leave in
production code. To eliminate it from the bundle entirely, use a ternary with
your bundler's dev-mode flag: the bundler collapses it to `{}` and tree-shakes
the import.

```ts
// Vite
.use(import.meta.env.DEV ? devtools() : {})

// webpack / Next.js
.use(process.env.NODE_ENV !== "production" ? devtools() : {})
```

### State changes forwarded to the extension

Every change is sent to the extension as an `"@@CHANGE"` action with the new
state. The extension's diff view shows what changed. The store doesn't track
which call made a change, so changes are not labeled by method name.

### Supported panel actions

| Panel action           | Effect on the store                                 |
| ---------------------- | --------------------------------------------------- |
| Jump to state / action | Restores the selected state snapshot                |
| Reset                  | Restores the initial state (at plugin activation)   |
| Commit                 | Makes the current state the new rollback baseline   |
| Rollback               | Restores the last committed state                   |
| Import state           | Restores the active state from the imported session |

Toggle action and reorder action are not supported because they require
replaying individual actions rather than restoring snapshots.

### Options

| Option | Type     | Default       | Description                                   |
| ------ | -------- | ------------- | --------------------------------------------- |
| `name` | `string` | `"kin-store"` | Name shown in the DevTools instance selector. |

---

## `history`

Tracks state history and enables undo / redo / reset. Every state change,
however it happens (`set`, `merge`, or any plugin method), is recorded,
because the plugin records via `this.subscribe()` rather than hooking any
particular write path. Pass `{ limit }` to cap memory use in apps with
frequent changes.

```ts
import { history } from "@kintools/store-plugins";

const store = createStore({ count: 0 })
  .use({
    increment(n: number): void {
      this.merge((s) => ({ count: s.count + n }));
    },
  })
  .use("history", history());

store.increment(1); // count = 1
store.increment(1); // count = 2

store.history.canUndo(); // true
store.history.undo(); // count = 1
store.history.redo(); // count = 2
store.history.reset(); // count = 0
```

### Plugin methods

| Method      | Description                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| `canUndo()` | `true` if there is a past state to undo                                                                     |
| `canRedo()` | `true` if there is a future state to redo                                                                   |
| `undo()`    | Move back one step; returns `true` if moved, `false` if already at start                                    |
| `redo()`    | Move forward one step; returns `true` if moved, `false` if already at end                                   |
| `reset()`   | Restore the baseline state and clear the history (with `limit`, baseline is the earliest remembered state)  |
| `rebase()`  | Make the current state the new undo floor, discard prior history                                            |

### Options

| Option  | Type     | Default     | Description                                                           |
| ------- | -------- | ----------- | ----------------------------------------------------------------------- |
| `limit` | `number` | `undefined` | Max snapshots to keep. When exceeded, the oldest snapshot is dropped. |

### Composing with `persist`

Place `history` after `persist`. After async hydration, call `rebase()` so
`undo` and `reset` do not step back to the pre-hydration state.

```ts
const store = createStore({ items: [] as string[] })
  .use("persist", persist({ key: "items" }))
  .use("history", history())
  .use({
    addItem(item: string): void {
      this.merge((s) => ({ items: [...s.items, item] }));
    },
  });

await store.persist.hydrationComplete();
store.history.rebase();
```

---

## `immer`

Lets you write methods (and `set` calls) as
[Immer](https://immerjs.github.io/immer/) draft mutations instead of
returning new state objects. `immer(plugin)` wraps a plugin written against an
`ImmerStore` (identical to a normal store, except `set` accepts a recipe
`(draft) => void`) and returns a standard `StorePlugin` ready for
`store.use()`.

```ts
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

Every method (and `onActivated`/`onDestroy`) is individually wrapped so `this`
resolves to the Immer-flavored store no matter how it's reached, externally,
or via a sibling/earlier-plugin call through `this`. Can be namespaced like
any other plugin:

```ts
const store = createStore({ todos: [] as Todo[] }).use(
  "todos",
  immer({
    add(title: string): void {
      this.set((draft) => {
        draft.todos.push({ id: Date.now(), title, done: false });
      });
    },
    toggle(id: number): void {
      this.set((draft) => {
        const todo = draft.todos.find((t) => t.id === id);
        if (todo) todo.done = !todo.done;
      });
    },
  }),
);

store.todos.add("Buy milk");
store.todos.toggle(someId);
```

---

## `persist`

Persists and hydrates the store state using a storage backend. Defaults to
`localStorage`. Any backend that implements `getItem` / `setItem` / `removeItem`
is accepted, including async ones.

### Basic usage

```ts
import { persist } from "@kintools/store-plugins";

const store = createStore({ count: 0 })
  .use({
    increment(n: number): void {
      this.merge((s) => ({ count: s.count + n }));
    },
  })
  .use("persist", persist({ key: "my-counter" }));

store.increment(1);
// State is automatically saved to localStorage["my-counter"].
// On the next page load, it is restored automatically.
```

### Persist a slice

```ts
.use("persist", persist({
  key: "app",
  selector: (s) => ({ token: s.token }),
}));
```

### Schema versioning

```ts
.use("persist", persist({
  key: "items",
  version: 1,
  migrate(stored: MyState, version: number): MyState {
    if (version === 0) return { items: stored.todos ?? [] };
    return stored;
  },
}));
```

### Custom async storage

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

.use("persist", persist({ key: "data", storage: asyncStorage }));
```

### SSR: skip auto-hydration

```ts
.use("persist", persist({ key: "user", skipHydration: true }));

// On the client, trigger hydration manually:
await store.persist.hydrate();
```

### Plugin methods

Once registered under a namespace (e.g. `"persist"`), the plugin exposes:

| Method                    | Description                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `hydrationComplete()`     | Promise that resolves after the current or next hydration          |
| `hasHydrated()`           | `true` if at least one hydration has completed                     |
| `hydrate()`               | Triggers a hydration; returns in-progress hydration if one exists  |
| `clear()`                 | Removes the persisted value from storage                           |
| `onHydrationStart(cb)`    | Called at the start of each hydration                              |
| `onHydrationComplete(cb)` | Called when a hydration completes                                  |
