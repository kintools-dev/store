"use client";

import { useSelector, useStoreContext } from "@kintools/store-react";
import type { Filter, TodoStore } from "../../lib/store.ts";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Done", value: "done" },
];

export function TodoFilter() {
  const store = useStoreContext<TodoStore>();
  const filter = useSelector(store, (s) => s.filter);
  const doneCount = useSelector(
    store,
    (s) => s.items.filter((it) => it.done).length,
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map(({ label, value }) => (
        <button
          type="button"
          key={value}
          onClick={() => store.setFilter(value)}
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
          onClick={() => store.clearDone()}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
        >
          Clear {doneCount} done
        </button>
      )}
    </div>
  );
}
