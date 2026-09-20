---
description: "The broadcast plugin syncs a store's entire state across browser tabs with BroadcastChannel, last-write-wins, with no storage dependency."
---

# broadcast

Syncs a store's entire state across browser tabs using `BroadcastChannel`.
Unlike [`persist`](/store/plugins/persist), it never touches storage: every
change is broadcast to other tabs directly, and an incoming state is applied
via `this.set()`. A tab opened after others requests the current state on
activation, so it doesn't have to wait for the next change to catch up.

## Basic usage

```ts
import { createStore } from "@kintools/store-core";
import { broadcast } from "@kintools/store-plugins";

const store = createStore({ items: [] as string[] })
  .use({
    add(item: string): void {
      this.merge((s) => ({ items: [...s.items, item] }));
    },
  })
  .use("broadcast", broadcast({ name: "todos" }));

store.add("hello"); // seen by other tabs sharing the "todos" channel
```

## Plugin methods

| Method    | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| `close()` | Closes the underlying `BroadcastChannel`. Also called on `destroy()`. |

## Options

| Option | Type     | Description                                                          |
| ------ | -------- | ---------------------------------------------------------------------- |
| `name` | `string` | The `BroadcastChannel` name. Only stores sharing the same name sync. |

```ts
.use("broadcast", broadcast({ name: "todos" }))
```

## Conflict resolution

Conflicts are resolved last-write-wins by wall-clock time: if two tabs change
state within the same millisecond, one of the changes is silently dropped.
For state that genuinely needs conflict resolution (concurrent edits merged
rather than one replacing the other), broadcast the specific operations
instead of the whole state, or reach for a CRDT library.

## Composing with persist

`broadcast` and `persist` solve different problems and compose cleanly:
`persist` survives a page reload, `broadcast` reaches other open tabs
immediately without waiting on a storage write.

```ts
const store = createStore({ items: [] as string[] })
  .use("persist", persist({ key: "todos" }))
  .use("broadcast", broadcast({ name: "todos" }));
```
