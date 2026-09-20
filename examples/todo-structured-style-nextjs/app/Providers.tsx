"use client";

import { useEffect, useRef } from "react";
import { StoreProvider } from "@kintools/store-react";
import { createTodoStore, type TodoStore } from "@/lib/store.ts";

export function Providers({ children }: { children: React.ReactNode }) {
  // useRef keeps the same store instance across re-renders without triggering
  // additional renders when the ref is set.
  const storeRef = useRef<TodoStore | null>(null);
  storeRef.current ??= createTodoStore();

  useEffect(() => {
    // Hydrate after mount so we never read localStorage on the server.
    storeRef.current!.persist.hydrate();
  }, []);

  return <StoreProvider store={storeRef.current}>{children}</StoreProvider>;
}
