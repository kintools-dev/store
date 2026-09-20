# @kintools/store-plugins

[![JSR @kintools/store-plugins](https://jsr.io/badges/@kintools/store-plugins)](https://jsr.io/@kintools/store-plugins)
![License: MIT](https://img.shields.io/badge/License-MIT-166534?style=flat)

Official plugins for `@kintools/store-core`.

| Plugin      | Description                                 |
| ----------- | ------------------------------------------- |
| `persist`   | Persists state to storage and hydrates it   |
| `history`   | Undo, redo, and reset                       |
| `immer`     | Writes methods as Immer draft mutations     |
| `devtools`  | Connects to the Redux DevTools extension    |
| `broadcast` | Syncs state across browser tabs and windows |

## Install

```sh [npm]
npm add @kintools/store-plugins
```

```sh [pnpm]
pnpm add @kintools/store-plugins
```

```sh [deno]
deno add jsr:@kintools/store-plugins
```

`immer` needs the `immer` package installed alongside it.

## Usage

Pass a plugin to `.use()`. Give it a namespace to expose its methods at
`store.<namespace>`.

```ts
import { createStore } from "@kintools/store-core";
import { history, persist } from "@kintools/store-plugins";

const store = createStore({ count: 0 })
  .use("persist", persist({ key: "counter" }))
  .use("history", history())
  .use({
    increment(n: number): void {
      this.merge((s) => ({ count: s.count + n }));
    },
  });

store.increment(1);
store.history.undo();
```

## Docs

[kintools.dev/store/plugins](https://kintools.dev/store/plugins)
