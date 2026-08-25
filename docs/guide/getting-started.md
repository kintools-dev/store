---
description: "Install @kintools/store-core, @kintools/store-react, or @kintools/store-plugins from JSR, write your first store with createStore, and grow it with withPlugins."
---

# Getting Started

## Install

For vanilla projects:

<CodeGroup>

<CodeGroupItem label="npm">

```sh
npm add @kintools/store-core
```

</CodeGroupItem>

<CodeGroupItem label="pnpm">

```sh
pnpm add @kintools/store-core
```

</CodeGroupItem>

<CodeGroupItem label="yarn">

```sh
yarn add @kintools/store-core
```

</CodeGroupItem>

<CodeGroupItem label="deno">

```sh
deno add jsr:@kintools/store-core
```

</CodeGroupItem>

</CodeGroup>

For React projects (`@kintools/store-core` is included):

<CodeGroup>

<CodeGroupItem label="npm">

```sh
npm add @kintools/store-react
```

</CodeGroupItem>

<CodeGroupItem label="pnpm">

```sh
pnpm add @kintools/store-react
```

</CodeGroupItem>

<CodeGroupItem label="yarn">

```sh
yarn add @kintools/store-react
```

</CodeGroupItem>

<CodeGroupItem label="deno">

```sh
deno add jsr:@kintools/store-react
```

</CodeGroupItem>

</CodeGroup>

To add official plugins:

<CodeGroup>

<CodeGroupItem label="npm">

```sh
npm add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="pnpm">

```sh
pnpm add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="yarn">

```sh
yarn add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="deno">

```sh
deno add jsr:@kintools/store-plugins
```

</CodeGroupItem>

</CodeGroup>

## Quick start

Create a store, write plain functions, done:

```ts
import { createStore } from "@kintools/store-core";

type TodoState = { todos: string[]; status: "idle" | "loading" };

const store = createStore({ todos: [], status: "idle" } as TodoState);

function addTodo(text: string): void {
  store.set((s) => ({ ...s, todos: [...s.todos, text] }));
}

addTodo("Buy groceries");
console.log(store.get());
// { todos: ['Buy groceries'], status: 'idle' }
```

When your app grows, move logic into the store with `.use()`:

```ts
import { withPlugins } from "@kintools/store-core";
import { history, persist } from "@kintools/store-plugins";

const store = withPlugins({ todos: [], status: "idle" } as TodoState)
  .use("persist", persist({ key: "todos" }))
  .use("history", history())
  .use({
    methods: (store) => ({
      addTodo(text: string): void {
        store.set((s) => ({ ...s, todos: [...s.todos, text] }));
      },
    }),
  });

store.addTodo("Buy groceries");
store.history.undo();
await store.persist.hydrate();
```

Each `.use()` adds capability, not a nesting level. The store grows with you.

## What's next

- [createStore](/store/guide/create-store) — the minimal foundation
- [withPlugins](/store/guide/with-plugins) — add methods, reducers, and
  middleware
- [derive](/store/guide/derive) — compose stores reactively
- [Plugins](/store/plugins/) — persist, history, immer
