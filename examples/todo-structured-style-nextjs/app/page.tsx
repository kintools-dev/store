import { TodoFilter } from "./components/TodoFilter.tsx";
import { TodoInput } from "./components/TodoInput.tsx";
import { TodoList } from "./components/TodoList.tsx";

// Server Component, renders the shell; client components handle interactivity.
export default function Page() {
  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="p-6 bg-gray-900 rounded-xl border border-slate-800 shadow-xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Todo App</h1>
        <TodoInput />
        <TodoFilter />
        <TodoList />
      </div>
      <p className="mt-6 text-center text-slate-400 text-sm">
        Kin Store example: Next.js · persist plugin · StoreProvider
      </p>
    </div>
  );
}
