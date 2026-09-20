"use client";

import { useStore, useStoreContext } from "@kintools/store-react";
import type { Todo, TodoStore } from "@/lib/store.ts";

function TodoItem({ item }: { item: Todo }) {
  const store = useStoreContext<TodoStore>();

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-800 bg-slate-800/20 ${
        item.done ? "opacity-70" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => store.toggleTodo(item.id)}
        className="w-4 h-4 rounded cursor-pointer accent-pink-500"
      />
      <span
        className={`flex-1 select-none ${
          item.done ? "text-slate-400 line-through" : "text-slate-200"
        }`}
      >
        {item.text}
      </span>
      <button
        type="button"
        onClick={() => store.removeTodo(item.id)}
        aria-label="Remove"
        className="text-slate-600 hover:text-slate-300 cursor-pointer transition-colors text-lg leading-none"
      >
        ×
      </button>
    </li>
  );
}

export function TodoList() {
  const store = useStoreContext<TodoStore>();
  const { items, filter } = useStore(store);

  const visible = items.filter(
    (it) => filter === "all" || (filter === "active" ? !it.done : it.done),
  );

  if (visible.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 select-none italic">
        {filter === "all" ? "No tasks yet!" : `No ${filter} tasks.`}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 p-0 list-none m-0">
      {visible.map((item) => <TodoItem key={item.id} item={item} />)}
    </ul>
  );
}
