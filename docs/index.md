---
layout: home
---

<Home>

<Hero title="Kin Store" lede="Start with a plain store. Add structure only when the app earns it." description="A framework-agnostic reactive state library for TypeScript.">
  <Button href="/store/guide/getting-started">Get Started</Button>
  <Button href="https://github.com/kintools-dev/store" variant="secondary" external>View on GitHub</Button>
</Hero>

<Section>
<SectionHeader>Why it exists</SectionHeader>
<Prose>Most state libraries pick your architecture before you know if the app needs one: actions, reducers, selectors, a provider tree, decided on day one. Kin Store leaves that decision to you.</Prose>
<Prose><code>set</code> and <code>dispatch</code> are equally first-class, not a beginner tier and an advanced one, so the mutation style a store uses is a choice your team makes, not one the library makes for you.</Prose>
</Section>

<Section>
<SectionHeader>What it does differently</SectionHeader>
<Card>
<Grid cols={3} divided>
<Primitive step="01" name="createStore" size="231 B"><code>get</code>, <code>set</code>, <code>subscribe</code>. Nothing else.</Primitive>
<Primitive step="02" name="withPlugins" size="1.0 KB">Add methods, reducers, and middleware, one <code>.use()</code> at a time.</Primitive>
<Primitive step="03" name="derive" size="438 B">Compose stores into new ones. It tracks what you read, not a graph you maintain.</Primitive>
</Grid>
<Grid cols={2} className="mt-4 pt-4 border-t border-t-border">
<Principle title="Minimal by default">A store starts as <code>get</code>, <code>set</code>, <code>subscribe</code>, nothing else. Methods, reducers, middleware, and derived stores are things you add when you reach for them, not things you start with.</Principle>
<Principle title="Explicit, always">No proxies, no auto-tracked reactive graph, no immer unless you add it. State only changes where you called <code>set</code> or <code>dispatch</code>.</Principle>
<Principle title="Plugins don't wrap">Each plugin declares what it adds. Stack ten of them and the chain still reads top-to-bottom, nothing nested to unwind.</Principle>
<Principle title="Derived state, no wiring"><code>derive</code> tracks which stores you read automatically. No selector library, no dependency array to keep in sync by hand.</Principle>
</Grid>
</Card>
</Section>

<Section>
<SectionHeader>Is Kin Store a fit?</SectionHeader>
<Card>
<Grid cols={2}>
<div>
<Lede as="h3">Use it when state should start minimal</Lede>
<ul className="list-disc pl-5 [&>li+li]:mt-2">
  <li>State should start minimal, not architected upfront</li>
  <li>You want typed reducers, middleware, or devtools, only where it matters</li>
  <li>You want structure and traceability, without the ceremony</li>
</ul>
</div>
<div>
<Lede as="h3">Skip it when the simple thing is enough</Lede>
<ul className="list-disc pl-5 [&>li+li]:mt-2">
  <li>You need server-owned state: that's TanStack Query/SWR's job</li>
  <li>You need non-React bindings today; Vue, Svelte, and Solid aren't published yet</li>
  <li>Redux or Zustand already works fine for your team</li>
</ul>
</div>
</Grid>
</Card>
</Section>

<Section>
<SectionHeader>How it compares</SectionHeader>
<FeatureMatrix />
<p className="mt-6">For full comparison, <Cta href="/store/comparison/">see the details →</Cta></p>
</Section>

<Section>
<SectionHeader>See it for yourself</SectionHeader>

<Lede step="01">Declare</Lede>

```ts
import { createStore } from "@kintools/store-core";

const count = createStore(0);

const theme = createStore<"light" | "dark">("light");

type TodoState = {
  items: string[];
  status: "idle" | "loading";
};
const todos = createStore<TodoState>({
  items: [],
  status: "idle",
});
```

<br/>
<br/>

<Lede step="02">Read, write, subscribe</Lede>

```ts
count.set((n) => n + 1);
theme.set("dark");
todos.set((s) => ({ ...s, items: [...s.items, "Buy milk"] }));

console.log(count.get()); // 1

const unsubscribe = count.subscribe((get, prev) => {
  console.log(prev, "->", get());
});
count.set((n) => n + 1); // logs "1 -> 2"
```

<br/>
<br/>

<Lede step="03">Compose</Lede>

<Prose>
`derive` automatically tracks dependencies without requiring a complex
reactive graph runtime, thanks to the explicit `get(store)` calls.
</Prose>

```ts
import { derive } from "@kintools/store-core";

const itemCount = derive((get) => get(todos).items.length);
console.log(itemCount.get()); // 1
```

<br/>
<br/>

<Lede step="04">When the store earns it, add structure</Lede>

<Prose>
Each `use()` registers a plugin (namespaced or top-level).
Plugins are plain objects declaring methods, reducers, middleware, lifecycle hooks.
Nothing wraps or patches the store.
</Prose>

```ts
import { withPlugins } from "@kintools/store-core";
import { devtools, persist } from "@kintools/store-plugins";

const store = withPlugins(todos)
  .use("persist", persist({ key: "todos" }))
  .use("devtools", devtools())
  .use({
    methods: (store) => ({
      addTodo(text: string): void {
        store.set((s) => ({ ...s, items: [...s.items, text] }));
      },
      async fetchTodos(): Promise<void> {
        store.set((s) => ({ ...s, status: "loading" }));
        const items = await api.fetchTodos();
        store.set({ items, status: "idle" });
      },
    }),
  });

await store.persist.hydrate(); // From the namespaced persist plugin.
store.addTodo("Buy milk"); // From the top-level inline plugin.
```

<br/>
<br/>

<Lede step="05">Need traceability? Add reducers and replace <code>set</code> by
<code>dispatch</code> for those changes</Lede>

```ts {5-9,12,14}
const store = withPlugins(todos)
  .use("persist", persist({ key: "todos" }))
  .use("devtools", devtools())
  .use({
    reducers: {
      addTodo: (s, text: string) => ({ ...s, items: [...s.items, text] }),
      fetchStart: (s) => ({ ...s, status: "loading" }),
      fetchDone: (_s, items: string[]) => ({ items, status: "idle" }),
    },
    methods: (store) => ({
      async fetchTodos(): Promise<void> {
        store.dispatch.fetchStart();
        const items = await api.fetchTodos();
        store.dispatch.fetchDone(items);
      },
    }),
  });

store.dispatch.addTodo("Buy milk"); // Full intellisense, logged in devtools.
```

<br/>
<Prose><code>set</code>/<code>dispatch</code> are both first-class here: pick
whichever fits this store or method, not a ladder from one to the other.</Prose>
<br/>

<Lede>In React</Lede>

```tsx {5,7,12,19}
import { useSelector, useStore } from "@kintools/store-react";

function Counter(): JSX.Element {
  // Re-renders on every change. Works great for primitive stores.
  const value = useStore(count);

  return <button onClick={() => count.set((n) => n + 1)}>{value}</button>;
}

function TodoList(): JSX.Element {
  // Re-renders only when items changes.
  const items = useSelector(store, (s) => s.items);

  return (
    <ul>
      {items.map((item) => <li key={item}>{item}</li>)}

      {/* Direct method reference. No hook, no subscription. */}
      <button onClick={() => store.addTodo("Buy milk")}>Add</button>
    </ul>
  );
}
```

</Section>

</Home>
