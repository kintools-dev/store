import { useRef, useSyncExternalStore } from "react";

import { type ReadonlyStore, shallowEqual } from "@kintools/store-core";

/**
 * Reads the whole state and triggers re-renders on every state change.
 *
 * Internally uses React's `useSyncExternalStore`, so it is safe to use in
 * concurrent mode.
 *
 * To read a transformed value derived from the state, use
 * {@linkcode useSelector} instead.
 *
 * @template TState The store's state type.
 *
 * @param store The store to read from.
 *
 * @example Reading the whole state
 * ```tsx
 * const counter = createStore(0);
 *
 * function Counter(): JSX.Element {
 *   const count = useStore(counter);
 *   return <div>{count}</div>;
 * }
 * ```
 */
export function useStore<TState>(store: ReadonlyStore<TState>): TState {
  return useSyncExternalStore<TState>(store.subscribe, store.get, store.get);
}

/**
 * Selects a transformed value from the state and triggers re-renders when it
 * changes.
 *
 * This hook accepts a custom equality function to determine if the selected
 * value has changed. This can be useful to avoid unnecessary re-renders when
 * the selector returns a new object reference on every call (e.g.
 * `.filter()`, `.map()`, or object literals). Defaults to
 * {@linkcode shallowEqual}, which compares the value one level deep.
 *
 * @template TState The store's state type.
 * @template TSelected The type of the selected value.
 *
 * @param store The store to select from.
 * @param selector The selector function to derive a value from the state.
 * @param equalFn The equality function to compare the previous and next
 * selected values. Return `true` if they are considered equal (i.e. no
 * re-render is needed). Only called once a previous value exists, so `prev`
 * is never `undefined`; the first computed value is used as-is. Defaults to
 * {@linkcode shallowEqual}.
 * @returns The selected value.
 *
 * @example Selecting a derived value to avoid unnecessary re-renders
 * ```tsx
 * function UserName(): JSX.Element {
 *   // Only re-renders when `name` changes, not on every state update.
 *   const name = useSelector(userStore, (s) => s.name);
 *   return <span>{name}</span>;
 * }
 * ```
 *
 * @example Avoiding re-renders for derived arrays with the default shallow equality
 * ```tsx
 * function ActiveTodos(): JSX.Element {
 *   // selector returns a new array each time; the default shallowEqual
 *   // prevents a re-render when the contents haven't changed.
 *   const active = useSelector(
 *     todoStore,
 *     (s) => s.items.filter((item) => !item.completed),
 *   );
 *
 *   return <ul>{active.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
 * }
 * ```
 *
 * @example Using a custom equality function for tolerance-based comparison
 * ```tsx
 * // shallowEqual requires an exact match per field; this instead ignores
 * // floating-point drift smaller than 0.001 in the computed ratio.
 * const progress = useSelector(
 *   downloadStore,
 *   (s) => s.bytesLoaded / s.totalBytes,
 *   (a, b) => Math.abs(a - b) < 0.001,
 * );
 * ```
 */
export function useSelector<TState, TSelected = TState>(
  store: ReadonlyStore<TState>,
  selector: (state: TState) => TSelected,
  equalFn: (prev: TSelected, next: TSelected) => boolean = shallowEqual,
): TSelected {
  const selectedRef = useRef<TSelected>(undefined);

  const getSnapshot = (): TSelected => {
    const prev = selectedRef.current;
    const next = selector(store.get());
    return prev !== undefined && equalFn(prev, next)
      ? prev
      : (selectedRef.current = next);
  };

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    getSnapshot,
  );
}
