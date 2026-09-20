import { createContext, type JSX, type ReactNode, useContext } from "react";

import type { ReadonlyStore } from "@kintools/store-core";

const StoreContext = createContext<ReadonlyStore | null>(null);

/**
 * React context provider that makes a store available to
 * {@linkcode useStoreContext} anywhere in the component tree below it.
 *
 * This is useful when you want to inject a store as a dependency (e.g. for
 * testing or server-side rendering) rather than importing a module-level
 * singleton.
 *
 * @example
 * ```tsx
 * const store = createStore({ count: 0 }).use(counterPlugin);
 *
 * function App(): JSX.Element {
 *   return (
 *     <StoreProvider store={store}>
 *       <Counter />
 *     </StoreProvider>
 *   );
 * }
 *
 * function Counter(): JSX.Element {
 *   const store = useStoreContext<typeof store>();
 *   const count = useSelector(store, (s) => s.count);
 *   return <button onClick={() => store.increment(1)}>{count}</button>;
 * }
 * ```
 */
export function StoreProvider({
  store,
  children,
}: {
  store: ReadonlyStore;
  children: ReactNode;
}): JSX.Element {
  return <StoreContext.Provider value={store}>{children}
  </StoreContext.Provider>;
}

/**
 * Returns the store injected by the nearest {@linkcode StoreProvider} ancestor.
 *
 * Intentionally named `useStoreContext` instead of `useStore` to clearly
 * indicate that this hook only triggers re-render when the store itself changes
 * rather than its state.
 *
 * To subscribe to the store's state changes, use {@linkcode useStore} or
 * {@linkcode useSelector}.
 *
 * @throws If called outside a `<StoreProvider>` tree.
 *
 * @example
 * ```tsx
 * function MyComponent(): JSX.Element {
 *   const store = useStoreContext<MyStore>();
 *   const value = useSelector(store, (s) => s.someField);
 *   return <div>{value}</div>;
 * }
 * ```
 */
export function useStoreContext<TStore extends ReadonlyStore>(): TStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error(
      "useStoreContext can only be used in a <StoreProvider> context",
    );
  }
  return store as TStore;
}
