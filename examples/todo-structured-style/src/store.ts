import { createStore } from "@kintools/store-core";
import { devtools, immer, persist } from "@kintools/store-plugins";

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
