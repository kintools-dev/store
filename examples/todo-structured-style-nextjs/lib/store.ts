import { createStore } from "@kintools/store-core";
import { immer, persist } from "@kintools/store-plugins";

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
    .use(
      immer({
        addTodo(text: string): void {
          this.set((draft) => {
            draft.items.push({ id: Date.now(), text, done: false });
          });
        },
        toggleTodo(id: number): void {
          this.set((draft) => {
            const item = draft.items.find((it) => it.id === id);
            if (item) item.done = !item.done;
          });
        },
        removeTodo(id: number): void {
          this.set((draft) => {
            draft.items = draft.items.filter((it) => it.id !== id);
          });
        },
        clearDone(): void {
          this.set((draft) => {
            draft.items = draft.items.filter((it) => !it.done);
          });
        },
        setFilter(filter: Filter): void {
          this.set((draft) => {
            draft.filter = filter;
          });
        },
      }),
    );
}

export type TodoStore = ReturnType<typeof createTodoStore>;
