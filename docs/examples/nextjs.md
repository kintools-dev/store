---
description: "A Next.js App Router todo app showing what SSR changes about using a store: where the instance lives, and when persist is allowed to touch localStorage."
---

# Next.js

A todo app on the App Router, demonstrating the two things SSR changes about
using a store: where the instance lives, and when `persist` is allowed to touch
`localStorage`. Full source in
[`examples/todo-redux-style-nextjs`](https://github.com/kintools-dev/store/tree/main/examples/todo-redux-style-nextjs).

## The store

```ts
// lib/store.ts
import { withPlugins } from "@kintools/store-core";
import { immer, persist } from "@kintools/store-plugins";

export type Filter = "all" | "active" | "done";
export type Todo = { id: number; text: string; done: boolean };
export type TodoState = { items: Todo[]; filter: Filter };

// Factory so each client render gets its own store instance — no shared
// state between SSR requests. Provided to the component tree via
// StoreProvider.
export function createTodoStore() {
  return withPlugins<TodoState>({ items: [], filter: "all" })
    .use(
      "persist",
      persist({
        key: "nextjs-todo",
        // Skip auto-hydration: localStorage is not available during SSR.
        // Providers.tsx calls store.persist.hydrate() after the client mounts.
        skipHydration: true,
        // Persist only items; filter resets to "all" on every page load.
        selector: (s) => ({ items: s.items }),
      }),
    )
    .use(
      immer({
        reducers: {
          addTodo(draft, text: string) {
            draft.items.push({ id: Date.now(), text, done: false });
          },
          toggleTodo(draft, id: number) {
            const item = draft.items.find((it) => it.id === id);
            if (item) item.done = !item.done;
          },
          removeTodo(draft, id: number) {
            draft.items = draft.items.filter((it) => it.id !== id);
          },
          clearDone(draft) {
            draft.items = draft.items.filter((it) => !it.done);
          },
          setFilter(draft, filter: Filter) {
            draft.filter = filter;
          },
        },
      }),
    );
}

export type TodoStore = ReturnType<typeof createTodoStore>;
```

It's a factory function, not a module-level singleton. A module-level store
would be shared across every SSR request handled by the same server process —
one user's todos leaking into another's response. `createTodoStore()` gives each
render its own instance instead.

`persist` is configured with `skipHydration: true` because `localStorage`
doesn't exist on the server. Hydration is triggered explicitly on the client
instead (below). `selector` also excludes `filter` from persistence, so a
returning visitor always lands back on the "all" view rather than whatever
filter they last had open.

## Wiring it up

```tsx
// app/Providers.tsx
"use client";

import { useEffect, useState } from "react";
import { StoreProvider } from "@kintools/store-react";
import { createTodoStore } from "@/lib/store.ts";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(createTodoStore);

  useEffect(() => {
    // Hydrate after mount so we never read localStorage on the server.
    store.persist.hydrate();
  }, [store]);

  return <StoreProvider store={store}>{children}</StoreProvider>;
}
```

`useState(createTodoStore)` runs the factory once per component instance (not
once per render), and `StoreProvider` makes that instance available to the whole
tree via context instead of a module import, which is what lets each request get
its own store in the first place.

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Providers } from "./Providers.tsx";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`page.tsx` itself stays a Server Component — only the leaf components that
actually read or write the store need `"use client"`:

```tsx
// app/page.tsx
import { TodoFilter } from "./components/TodoFilter.tsx";
import { TodoInput } from "./components/TodoInput.tsx";
import { TodoList } from "./components/TodoList.tsx";

export default function Page() {
  return (
    <div>
      <TodoInput />
      <TodoFilter />
      <TodoList />
    </div>
  );
}
```

## Reading and writing from a component

Client components pull the store out of context with `useStoreContext`, then use
`useStore`/`useSelector` and `dispatch` as usual:

```tsx
// app/components/TodoList.tsx
"use client";

import { useStore, useStoreContext } from "@kintools/store-react";
import type { Todo, TodoStore } from "@/lib/store.ts";

function TodoItem({ item }: { item: Todo }) {
  const store = useStoreContext<TodoStore>();

  return (
    <li>
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => store.dispatch.toggleTodo(item.id)}
      />
      <span>{item.text}</span>
      <button onClick={() => store.dispatch.removeTodo(item.id)}>×</button>
    </li>
  );
}

export function TodoList() {
  const store = useStoreContext<TodoStore>();
  const { items, filter } = useStore(store);

  const visible = items.filter(
    (it) => filter === "all" || (filter === "active" ? !it.done : it.done),
  );

  return (
    <ul>
      {visible.map((item) => <TodoItem key={item.id} item={item} />)}
    </ul>
  );
}
```

`useStoreContext<TodoStore>()` is what makes the store type-safe here, since
there's no module-level export to import a type from directly. See
[`StoreProvider` and `useStoreContext`](/store/react/#storeprovider-and-usestorecontext)
for the general pattern.
