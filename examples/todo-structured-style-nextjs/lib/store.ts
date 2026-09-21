import { createStore } from "@kintools/store-core";
import { persist } from "@kintools/store-plugins";

export type Filter = "all" | "active" | "done";

export type Todo = {
  id: number;
  text: string;
  done: boolean;
};

export type TodoState = {
  items: Todo[];
  filter: Filter;
};

/**
 * Factory so each client render gets its own store instance, no shared
 * state between SSR requests. Provided to the component tree via StoreProvider.
 */
export function createTodoStore() {
  return createStore<TodoState>({ items: [], filter: "all" })
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
    .use({
      addTodo(text: string): void {
        this.merge((state) => ({
          items: [...state.items, { id: Date.now(), text, done: false }],
        }));
      },
      toggleTodo(id: number): void {
        this.merge((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, done: !item.done } : item,
          ),
        }));
      },
      removeTodo(id: number): void {
        this.merge((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },
      clearDone(): void {
        this.merge((state) => ({
          items: state.items.filter((item) => !item.done),
        }));
      },
      setFilter(filter: Filter): void {
        this.merge({ filter });
      },
    });
}

export type TodoStore = ReturnType<typeof createTodoStore>;
