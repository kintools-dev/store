---
description: "The history plugin records every state change as a snapshot and adds undo, redo, and reset, with an optional cap on how many snapshots to keep."
---

# history

Tracks state history and enables undo / redo / reset. Every state change,
however it happens (`set`, `merge`, or any plugin method), is recorded,
because the plugin records via `this.subscribe()` rather than hooking any
particular write path.

## Basic usage

```ts
import { createStore } from "@kintools/store-core";
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

## Plugin methods

| Method      | Description                                                                |
| ----------- | -------------------------------------------------------------------------- |
| `canUndo()` | Returns `true` if there is a past state to undo to                         |
| `canRedo()` | Returns `true` if there is a future state to redo to                       |
| `undo()`    | Moves back one step; returns `true` if moved, `false` if already at start  |
| `redo()`    | Moves forward one step; returns `true` if moved, `false` if already at end |
| `reset()`   | Restores the baseline state and clears the history                         |
| `rebase()`  | Makes the current state the new undo floor, discarding prior history       |

## Options

| Option  | Type     | Default    | Description                                                  |
| ------- | -------- | ---------- | ------------------------------------------------------------ |
| `limit` | `number` | `Infinity` | Max snapshots to keep. When exceeded, the oldest is dropped. |

```ts
.use('history', history({ limit: 50 }))
```

## Composing with persist

After async hydration, call `rebase()` so `undo` and `reset` don't step back
to the pre-hydration state:

```ts
const store = createStore({ items: [] as string[] })
  .use("persist", persist({ key: "items" }))
  .use("history", history())
  .use({
    add(item: string): void {
      this.merge((s) => ({ items: [...s.items, item] }));
    },
  });

await store.persist.hydrationComplete();
store.history.rebase();
```
