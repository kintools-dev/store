---
description: "The broadcast plugin syncs a store's entire state across browser tabs with BroadcastChannel, last-write-wins, with no storage dependency."
---

# broadcast

Syncs a store's entire state across browser tabs using `BroadcastChannel`.
Unlike [`persist`](/store/plugins/persist), it never touches storage: every
change is broadcast to other tabs directly, and applying one back travels
through the reducer pipeline via an internal `_apply` reducer so middlewares can
observe it. A tab opened after others requests the current state on activation,
so it doesn't have to wait for the next change to catch up.

## Basic usage

```ts
import { withPlugins } from "@kintools/store-core";
import { broadcast } from "@kintools/store-plugins";

const store = withPlugins({ items: [] as string[] })
  .use({
    reducers: {
      add: (state, item: string) => ({ items: [...state.items, item] }),
    },
  })
  .use("broadcast", broadcast({ name: "todos" }));

store.dispatch.add("hello"); // seen by other tabs sharing the "todos" channel
```

## Plugin methods

| Method    | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| `close()` | Closes the underlying `BroadcastChannel`. Also called on `destroy()`. |

## Options

| Option | Type     | Description                                                          |
| ------ | -------- | -------------------------------------------------------------------- |
| `name` | `string` | The `BroadcastChannel` name. Only stores sharing the same name sync. |

```ts
.use("broadcast", broadcast({ name: "todos" }))
```

## Conflict resolution

Conflicts are resolved last-write-wins by wall-clock time: if two tabs change
state within the same millisecond, one of the changes is silently dropped. For
state that genuinely needs conflict resolution (concurrent edits merged rather
than one replacing the other), broadcast the specific operations instead of the
whole state, or reach for a CRDT library.

## Composing with persist

`broadcast` and `persist` solve different problems and compose cleanly:
`persist` survives a page reload, `broadcast` reaches other open tabs
immediately without waiting on a storage write.

```ts
const store = withPlugins({ items: [] as string[] })
  .use("persist", persist({ key: "todos" }))
  .use("broadcast", broadcast({ name: "todos" }));
```

## Inside middleware

The plugin uses an internal `_apply` reducer to change state, so every incoming
update from another tab travels through the middleware pipeline. A logging
middleware will see it:

```ts
middleware: () => (ctx, next) => {
  // Includes "broadcast._apply", assuming the plugin is registered under
  // the "broadcast" namespace.
  console.log(ctx.reducer.name);
  return next();
},
```
