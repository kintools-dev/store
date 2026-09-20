---
description: "The official @kintools/store-plugins package: broadcast, devtools, history, immer, and persist, installed together and registered with .use()."
---

# Official Plugins

Official plugins for `@kintools/store-core`, published as
`@kintools/store-plugins`.

To learn how to write your own plugin, see
[Writing Plugins](/store/guide/writing-plugins).

## Install

`npm add @kintools/store-plugins` (or your package manager's equivalent); see
[Getting Started](/store/guide/getting-started#plugins) for every package
manager.

## Available plugins

| Plugin                                  | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| [`broadcast`](/store/plugins/broadcast) | Syncs state across browser tabs with `BroadcastChannel`      |
| [`devtools`](/store/plugins/devtools)   | Connects to the Redux DevTools Extension                     |
| [`history`](/store/plugins/history)     | Undo / redo / reset with snapshot history                    |
| [`immer`](/store/plugins/immer)         | Writes methods (and `set`) as Immer draft mutations           |
| [`persist`](/store/plugins/persist)     | Persists state to localStorage (or any custom storage)       |

## Usage pattern

All plugins are registered with `.use()`. Plugins can be top-level or
namespaced. Namespaced plugins (like `persist` and `history` below) expose their
methods under their namespace key:

```ts
import { createStore } from "@kintools/store-core";
import { history, immer, persist } from "@kintools/store-plugins";

const store = createStore({ todos: [] as string[], count: 0 })
  .use("persist", persist({ key: "my-store" }))
  .use("history", history({ limit: 50 }))
  .use(immer({
    add(text: string): void {
      this.set((draft) => {
        draft.todos.push(text);
      });
    },
  }));

await store.persist.hydrate();
store.history.undo();
store.add("hello"); // From the top-level inline plugin
```
