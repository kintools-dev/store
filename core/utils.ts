import type { Listener, ReadonlyStore } from "./create-store.ts";

/**
 * Compares two values one level deep: primitives (and identical references)
 * via `Object.is`, and arrays/objects by comparing their own enumerable keys
 * with `Object.is`, without recursing into nested values.
 *
 * @param a The first value.
 * @param b The second value.
 * @returns `true` if `a` and `b` are equal one level deep.
 *
 * @example Comparing derived arrays and objects
 * ```ts
 * shallowEqual([1, 2, 3], [1, 2, 3]); // true
 * shallowEqual({ a: 1 }, { a: 1 }); // true
 * shallowEqual({ a: 1 }, { a: 2 }); // false
 * shallowEqual({ a: { b: 1 } }, { a: { b: 1 } }); // false: nested object differs by reference
 * ```
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" || a === null ||
    typeof b !== "object" || b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  const record = b as Record<string, unknown>;
  for (const key of keysA) {
    if (
      !Object.hasOwn(record, key) ||
      !Object.is((a as Record<string, unknown>)[key], record[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Wraps a listener so that it only fires when a selected part of the state
 * changes, rather than on every state update.
 *
 * The value is extracted by `selector` on each state change. The listener is
 * only called when `equal` returns `false` for the previous and next selected
 * values. By default, {@linkcode shallowEqual} is used for equality
 * comparison.
 *
 * This utility is available for use in any context where you need to narrow
 * a broad {@linkcode Listener} down to a specific part of the state, for
 * example when subscribing to a store outside of React.
 *
 * @template TState The full state type of the store being subscribed to.
 * @template TSelected The type of the selected value the listener cares
 * about. It can be anything the selector returns.
 * @template TStore The type of `this` inside the listener. Inferred from the
 * store it is subscribed to, so on a regular store the listener can also call
 * `this.set()`/`this.merge()`, while on a derived store it can't.
 *
 * @param listener The narrowed listener to wrap. It receives the previous and
 * next selected values, and `this` inside it is the store, so `this.get()`
 * returns the full current state.
 * @param selector A function that picks the value of interest from the full
 * state.
 * @param options.equal An optional custom equality function. Defaults to
 * {@linkcode shallowEqual}.
 * @returns A new {@linkcode Listener} for `TState` that internally filters by
 * the selected value.
 *
 * @example Subscribing only to a counter inside a larger state
 * ```ts
 * const store = createStore({ count: 0, name: "Alice" });
 * const selectCount = (state: { count: number }) => state.count;
 *
 * const listener = listenerWithSelector(
 *   function (prevSelected, nextSelected) {
 *     console.log("count changed:", prevSelected, "->", nextSelected);
 *   },
 *   selectCount,
 * );
 *
 * store.subscribe(listener);
 *
 * store.set({ count: 1, name: "Alice" }); // logs: count changed: 0 -> 1
 * store.set({ count: 1, name: "Bob" });   // no log (count unchanged)
 * ```
 *
 * @example Using a custom equality function for arrays
 * ```ts
 * const listener = listenerWithSelector(
 *   function () {
 *     console.log("items:", this.get().items);
 *   },
 *   (state) => state.items,
 *   { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
 * );
 * ```
 */
export function listenerWithSelector<
  TState,
  TSelected,
  TStore extends ReadonlyStore<TState> = ReadonlyStore<TState>,
>(
  listener: (
    this: TStore,
    prevSelected: TSelected,
    nextSelected: TSelected,
  ) => void,
  selector: (state: TState) => TSelected,
  options: {
    equal?: (prevSelected: TSelected, nextSelected: TSelected) => boolean;
  } = {},
): Listener<TState, TStore> {
  const { equal = shallowEqual } = options;

  let selected: TSelected | undefined;

  return function (this: TStore, prevState: TState): void {
    const nextSelected = selector(this.get());

    if (selected === undefined) selected = selector(prevState);

    if (!equal(selected, nextSelected)) {
      const prevSelected = selected;
      selected = nextSelected;
      listener.call(this, prevSelected, nextSelected);
    }
  };
}
