---
description: "Kin Store: a tiny, fast, framework-agnostic reactive state library for TypeScript. Zero dependencies, full type inference, React bindings built in."
layout: home
---

<Home>

<Grid cols={[3, 4]} className="items-center">

<Hero title="Kin Store" lede="Start minimal. Grow structured." description="A tiny, framework-agnostic reactive state library for TypeScript.">
  <Button href="/store/guide/getting-started">Get Started</Button>
  <Button href="https://github.com/kintools-dev/store" variant="secondary" external>View on GitHub</Button>
</Hero>

<CodeGroup>

<CodeGroupItem label="npm">

```sh
# Vanilla projects.
npm add @kintools/store-core

# React projects (includes core).
npm add @kintools/store-react

# Optional plugins.
npm add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="pnpm">

```sh
# Vanilla projects.
pnpm add @kintools/store-core

# React projects (includes core).
pnpm add @kintools/store-react

# Optional plugins.
pnpm add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="yarn">

```sh
# Vanilla projects.
yarn add @kintools/store-core

# React projects (includes core).
yarn add @kintools/store-react

# Optional plugins.
yarn add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="bun">

```sh
# Vanilla projects.
bun add @kintools/store-core

# React projects (includes core).
bun add @kintools/store-react

# Optional plugins.
bun add @kintools/store-plugins
```

</CodeGroupItem>

<CodeGroupItem label="deno">

```sh
# Vanilla projects.
deno add jsr:@kintools/store-core

# React projects (includes core).
deno add jsr:@kintools/store-react

# Optional plugins.
deno add jsr:@kintools/store-plugins
```

</CodeGroupItem>

</CodeGroup>

</Grid>

<Section>
<Grid cols={[3, 4]} className="items-center">
<div>

<SectionHeader><code>createStore</code></SectionHeader>

A value plus `get`, `set`, `merge`, `subscribe`. Logic can live in plain
functions that call them, no framework required.

</div>
<div>

```ts {9,13,15}
import { createStore } from "@kintools/store-core";

const todos = createStore({
  items: [] as string[],
  status: "idle" as "idle" | "loading",
});

function addTodo(text: string): void {
  todos.merge((s) => ({ items: [...s.items, text] }));
}

async function fetchTodos(): Promise<void> {
  todos.merge({ status: "loading" });
  const items = await api.fetchTodos();
  todos.set({ items, status: "idle" });
}
```

</div>
</Grid>
</Section>

<Section>
<Grid cols={[3, 4]} className="items-center">
<div>

<SectionHeader>Add structure with <code>.use()</code></SectionHeader>

When a store earns it, each `.use()` registers a plugin: a declarative object
that defines methods and lifecycle hooks. Plugins can be top-level or
namespaced. Nothing wraps or patches the store underneath.

</div>
<div>

```ts {8,18-19}
import { createStore } from "@kintools/store-core";
import { devtools, persist } from "@kintools/store-plugins";

const todos = createStore({
  items: [] as string[],
  status: "idle" as "idle" | "loading",
})
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ items: [...s.items, text] }));
    },
    async fetchTodos(): Promise<void> {
      this.merge({ status: "loading" });
      const items = await api.fetchTodos();
      this.set({ items, status: "idle" });
    },
  })
  .use(devtools({ name: "todos" }))
  .use("persist", persist({ key: "todos" }));

todos.addTodo("Buy milk"); // Full intellisense.
await todos.persist.hydrationComplete(); // Full intellisense.
```

</div>
</Grid>
</Section>

<Section>
<Grid cols={[3, 4]} className="items-center">
<div>

<SectionHeader>React</SectionHeader>

`useStore` and `useSelector` subscribe a component to a store or a slice of it,
built on `useSyncExternalStore`. `useSelector` re-renders only when the selected
value changes.

<br/>

`@kintools/store-react` re-exports the core API, so a React app needs a single
install. See the [React bindings](/store/react).

<br/>

Methods are called directly on the store, like `todos.addTodo()` in the handler:
no hooks or subscriptions needed.

</div>
<div>

```tsx {10,16}
import { createStore, useSelector } from "@kintools/store-react";

const todos = createStore({ items: [] as string[] }).use({
  addTodo(text: string): void {
    this.merge((s) => ({ items: [...s.items, text] }));
  },
});

function TodoList() {
  const items = useSelector(todos, (s) => s.items);
  return (
    <>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <button onClick={() => todos.addTodo("Buy milk")}>Add</button>
    </>
  );
}
```

</div>
</Grid>
</Section>

<Section>
<Grid cols={[3, 4]} className="items-center">
<div>

<SectionHeader><code>derive</code></SectionHeader>

Compose one or more stores into a lazy, dependency-tracked, read-only view. It
tracks only the stores you call `get()` on: no selector arrays, no dependency
graph to maintain by hand.

</div>
<div>

```ts {3}
import { derive } from "@kintools/store-core";

const itemCount = derive((get) => get(todos).items.length);

itemCount.subscribe(function () {
  console.log(this.get());
});

todos.addTodo("Buy milk"); // logs 1
```

</div>
</Grid>
</Section>

<Section>
<SectionHeader>How it compares</SectionHeader>
<FeatureMatrix />
<p className="mt-6">For full comparison, <Cta href="/store/comparison">see the details →</Cta></p>
</Section>

</Home>
