import { createStore } from "@kintools/store-core";

export type Filter = "all" | "active" | "done";

export type Todo = {
  readonly id: number;
  text: string;
  done: boolean;
};

export const todoStore = createStore({
  items: [] as Todo[],
  filter: "all" as Filter,
});

const { merge } = todoStore;

export function addTodo(text: string): void {
  merge((s) => ({ items: [...s.items, { id: Date.now(), text, done: false }] }));
}

export function toggleTodo(id: number): void {
  merge((s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)),
  }));
}

export function removeTodo(id: number): void {
  merge((s) => ({ items: s.items.filter((it) => it.id !== id) }));
}

export function clearDone(): void {
  merge((s) => ({ items: s.items.filter((it) => !it.done) }));
}

export function setFilter(filter: Filter): void {
  merge({ filter });
}
