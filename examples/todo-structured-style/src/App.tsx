import { useSelector, useStore } from "@kintools/store-react";
import * as React from "react";
import { type Filter, type Todo, todoStore } from "./store.ts";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Done", value: "done" },
];

function TodoInput() {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      todoStore.addTodo(value);
      inputRef.current!.value = "";
    }
  }, []);

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        placeholder="Add a new task..."
        className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-500 -outline-offset-2!"
      />
      <button
        type="submit"
        className="px-4 py-2 font-semibold rounded-lg bg-pink-600 hover:bg-pink-500 text-white cursor-pointer"
      >
        Add
      </button>
    </form>
  );
}

function TodoFilterBar() {
  const filter = useSelector(todoStore, (s) => s.filter);
  const doneCount = useSelector(
    todoStore,
    (s) => s.items.filter((it) => it.done).length,
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map(({ label, value }) => (
        <button
          type="button"
          key={value}
          onClick={() => todoStore.setFilter(value)}
          className={`px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors ${
            filter === value
              ? "bg-pink-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
      {doneCount > 0 && (
        <button
          type="button"
          onClick={() => todoStore.clearDone()}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
        >
          Clear {doneCount} done
        </button>
      )}
    </div>
  );
}

function TodoItem({ item }: { item: Todo }) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-800 bg-slate-800/20 ${
        item.done ? "opacity-70" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => todoStore.toggleTodo(item.id)}
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
        onClick={() => todoStore.removeTodo(item.id)}
        aria-label="Remove"
        className="text-slate-600 hover:text-slate-300 cursor-pointer transition-colors text-lg leading-none"
      >
        ×
      </button>
    </li>
  );
}

function TodoList() {
  const { items, filter } = useStore(todoStore);
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

export function App() {
  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="p-6 bg-gray-900 rounded-xl border border-slate-800 shadow-xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Todo App</h1>
        <TodoInput />
        <TodoFilterBar />
        <TodoList />
      </div>
      <p className="mt-6 text-center text-slate-400 text-sm">
        Kin Store example: structured style · createStore · persist
      </p>
    </div>
  );
}
