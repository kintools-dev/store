# @kintools/store-core

[![JSR @kintools/store-core](https://jsr.io/badges/@kintools/store-core)](https://jsr.io/@kintools/store-core)
![License: MIT](https://img.shields.io/badge/License-MIT-166534?style=flat)

The core of Kin Store: `createStore` and `derive`. Framework-agnostic, zero
dependencies, fully type-safe.

## Install

```sh [npm]
npm add @kintools/store-core
```

```sh [pnpm]
pnpm add @kintools/store-core
```

```sh [deno]
deno add jsr:@kintools/store-core
```

## Usage

```ts
import { createStore, derive } from "@kintools/store-core";

const store = createStore({ count: 0 }).use({
  increment(n: number): void {
    this.merge((s) => ({ count: s.count + n }));
  },
});

store.subscribe(function () {
  console.log(this.get());
});

store.increment(1); // { count: 1 }

const doubled = derive((get) => get(store).count * 2);
doubled.get(); // 2
```

## Docs

[kintools.dev/store](https://kintools.dev/store)
