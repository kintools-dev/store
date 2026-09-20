"use client";

import { SubmitEvent, useCallback, useRef } from "react";
import { useStoreContext } from "@kintools/store-react";
import type { TodoStore } from "@/lib/store.ts";

export function TodoInput() {
  const store = useStoreContext<TodoStore>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: SubmitEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      store.addTodo(value);
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
