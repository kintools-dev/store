---
description: "`.use()` on createStore adds methods, namespacing, and lifecycle hooks one call at a time, each fully typed, with this-bound methods that can call each other."
---

# Using Plugins

Opt-in structure: methods, namespacing, lifecycle hooks.

`.use()` lives directly on the store returned by `createStore`; there's no
separate function to import for it. Each `.use()` call adds capability, not a
nesting level. The store's type is updated at each step, so TypeScript always
knows exactly what's available.

## Concepts

| Term       | Definition                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| **Plugin** | A plain object of methods, plus optional `onActivated`/`onDestroy` hooks. Each `.use()` call registers one. |
| **Method** | A function attached directly to the store, callable as `store.name(...)` or `store.<namespace>.name(...)`.  |

## Step 1: Colocate logic with methods

Move logic inside the store using `.use()`. Every method reaches the store
through `this`, including sibling methods and methods from earlier `.use()`
calls:

```ts
type TodoState = { todos: string[]; status: "idle" | "loading" | "failed" };

const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ todos: [...s.todos, text] }));
    },
    async fetchTodos(): Promise<void> {
      this.merge({ status: "loading" });
      try {
        const todos = await api.getTodos();
        this.set({ todos, status: "idle" });
      } catch {
        this.merge({ status: "failed" });
      }
    },
  });

todoStore.addTodo("Buy groceries");
await todoStore.fetchTodos();
```

`this` is bound via `Function.prototype.apply`, which only rebinds regular
functions. An arrow-function-valued method does not get this binding. Use
regular method syntax (`method() {}`) for anything that needs `this`.

## Step 2: Add plugins

Plugins can be **namespaced** (`.use(namespace, plugin)`) or **top-level**
(`.use(plugin)`). Namespaced plugins live under their own key, no conflicts, no
surprises:

```ts
import { history, persist } from "@kintools/store-plugins";

const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use("persist", persist({ key: "todos" }))
  .use("history", history())
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ todos: [...s.todos, text] }));
    },
  });

todoStore.addTodo("Buy groceries");
todoStore.history.undo();
await todoStore.persist.hydrate();
```

## Guarding against race conditions

Methods don't sequence or cancel async work for you. If `fetchTodos` can be
called again before the first call resolves, a slower first response can land
after a faster second one and overwrite it with stale data. Guard against it
with a request counter:

```ts
const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({ todos: [...s.todos, text] }));
    },
  });

let requestId = 0;

async function fetchTodos(): Promise<void> {
  const id = ++requestId;
  todoStore.merge({ status: "loading" });
  try {
    const todos = await api.getTodos();
    if (id !== requestId) return; // A newer call already resolved.
    todoStore.set({ todos, status: "idle" });
  } catch {
    if (id !== requestId) return;
    todoStore.merge({ status: "failed" });
  }
}
```

To cancel the in-flight request itself, rather than just ignoring its result,
pass an `AbortController`'s `signal` to `fetch` instead, aborting the previous
controller at the start of each call:

```ts
let controller: AbortController | undefined;

async function fetchTodos(): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  todoStore.merge({ status: "loading" });
  try {
    const todos = await api.getTodos({ signal: controller.signal });
    todoStore.set({ todos, status: "idle" });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    todoStore.merge({ status: "failed" });
  }
}
```

The same pattern applies inside a `.use()`-registered method: keep the counter
or controller in the plugin's closure and guard with `this.set`/ `this.merge`
the same way.

## Namespaced plugins with methods

Plugins can include their own methods, scoped under a namespace to prevent
conflicts:

```ts
const store = createStore({ todos: [] as string[] }).use("todos", {
  add(text: string): void {
    this.merge((s) => ({ todos: [...s.todos, text] }));
  },
  clear(): void {
    this.set({ todos: [] });
  },
  async fetch(): Promise<void> {
    const resp = await fetch("/api/todos");
    const todos = await resp.json();
    this.todos.add(todos[0]);
  },
});

store.todos.add("Buy groceries");
store.todos.clear();
await store.todos.fetch();
```

## Plugin shape

A plugin passed to `.use()` is a plain object with any combination of:

| Field         | Description                                          |
| ------------- | ---------------------------------------------------- |
| Methods       | Named functions, attached directly to the store      |
| `onActivated` | Runs once immediately after the plugin is registered |
| `onDestroy`   | Runs when `store.destroy()` is called                |

See [Writing Plugins](/store/guide/writing-plugins) for reusable, shareable
plugin factories.
