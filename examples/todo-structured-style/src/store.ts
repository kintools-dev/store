import { createStore } from "@kintools/store-core";
import { devtools, persist } from "@kintools/store-plugins";

export type Filter = "all" | "active" | "done";

export type Todo = Readonly<{
  id: number;
  text: string;
  done: boolean;
}>;

export const todoStore = createStore({
  items: [] as Todo[],
  filter: "all" as Filter,
})
  .use("persist", persist({ key: "todos" }))
  .use(import.meta.env.DEV ? devtools() : {})
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
