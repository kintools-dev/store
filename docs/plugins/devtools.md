---
description: "The devtools plugin connects a store to the Redux DevTools Extension for time-travel debugging: state inspection, jump-to-state, and reset/commit/rollback."
---

# devtools

Connects a store to the
[Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) for
time-travel debugging.

## Setup

Install the browser extension, then register the plugin. No namespace is
required because the plugin adds no public methods:

```ts
import { createStore } from "@kintools/store-core";
import { devtools } from "@kintools/store-plugins";

const store = createStore(0)
  .use({
    increment(n: number): void {
      this.set((s) => s + n);
    },
  })
  .use(devtools({ name: "counter" }));
```

## Options

| Option | Type     | Default       | Description                                                                                                      |
| ------ | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `name` | `string` | `"kin-store"` | Name shown in the extension's instance selector. Use a distinct name per store when registering multiple stores. |

## Production

The plugin is a no-op when the extension is absent, so it is safe to leave in
production code. To eliminate it from the bundle entirely, use a ternary with
your bundler's dev-mode flag:

```ts
// Vite
.use(import.meta.env.DEV ? devtools() : {})

// webpack / Next.js
.use(process.env.NODE_ENV !== "production" ? devtools() : {})
```

The bundler replaces the flag with `false`, collapses the ternary to `{}`, and
tree-shakes the `devtools` import.

## State changes

Every state change is forwarded to the extension automatically as an
`"@@CHANGE"` action with the new state. The extension's diff view shows what
changed. The store doesn't track which call made a change, so changes are not
labeled by method name.

## Supported panel actions

| Panel action           | Effect on the store                                 |
| ---------------------- | --------------------------------------------------- |
| Jump to state / action | Restores the selected state snapshot                |
| Reset                  | Restores the initial state (at plugin activation)   |
| Commit                 | Makes the current state the new rollback baseline   |
| Rollback               | Restores the last committed state                   |
| Import state           | Restores the active state from the imported session |

Toggle action and reorder action are not supported because they require
replaying individual actions rather than restoring snapshots.
