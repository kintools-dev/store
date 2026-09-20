import { throwError } from "./_internals.ts";
import type { Listener, ReadonlyStore } from "./create-store.ts";

/**
 * The `get` helper passed to a {@linkcode derive} compute function. Reads a
 * source store's current state and registers it as a tracked dependency.
 *
 * @template T The source store's state type.
 */
export type Getter = <T>(store: ReadonlyStore<T>) => T;

/**
 * The callback passed to {@linkcode derive}. See {@linkcode derive}'s
 * documentation for what `get` and `prev` do.
 *
 * @template TState The type of the derived value.
 */
export type ComputeFn<TState> = (
  get: Getter,
  prev: () => TState | undefined,
) => TState;

/**
 * A read-only store whose value is computed from one or more source stores.
 *
 * Dependencies are tracked automatically: every source store passed to `get`
 * inside the compute function becomes a dependency. The derived value is
 * recomputed lazily whenever any dependency changes.
 *
 * Use {@linkcode derive} to create a `DerivedStore`.
 *
 * @template TState The type of the derived value.
 */
export type DerivedStore<TState> =
  & ReadonlyStore<TState>
  & {
    /**
     * Destroys the store, removing all listeners and all dependencies.
     *
     * It's safe to call `destroy()` more than once. However, calling other
     * methods will throw an error after calling `destroy()`.
     */
    destroy(): void;
  };

/**
 * Creates a read-only store whose value is computed from other stores.
 *
 * Dependencies are discovered automatically the first time `get` is
 * called (or the first subscriber registers). After that, the derived value is
 * kept in sync reactively: it is recomputed lazily only when a dependency
 * actually changes.
 *
 * When there are no subscribers, the derived store is "cold": subscriptions to
 * source stores are dropped and the cached value is discarded. They are
 * re-established the next time a subscriber registers.
 *
 * @template TState The type of the derived value.
 *
 * @param compute A pure function that receives two helpers and returns the
 * derived value.
 *
 * - `get(sourceStore)`: reads a source store's current state and registers
 *   it as a dependency. Every store passed to `get` inside a single
 *   recompute becomes a tracked dependency for that run.
 * - `prev()`: returns the derived store's **previous** computed value
 *   (`undefined` on the very first computation). Use this to build
 *   accumulators or smoothing functions that incorporate their own prior
 *   output.
 *
 *   > **Note:** Because `prev` carries `TState` in its return type,
 *   > TypeScript cannot infer `TState` from the return expression when
 *   > `prev()` is used. Supply an explicit type parameter in that case:
 *   > `derive<number>((get, prev) => ...)`.
 *
 * @returns A {@linkcode DerivedStore} whose `get` returns the computed
 * value.
 *
 * @example Deriving from a single store
 * ```ts
 * const counter = createStore(2);
 * const doubled = derive((get) => get(counter) * 2);
 *
 * console.log(doubled.get()); // 4
 *
 * counter.set(5);
 * console.log(doubled.get()); // 10
 * ```
 *
 * @example Deriving from multiple stores
 * ```ts
 * const firstName = createStore("Ada");
 * const lastName = createStore("Lovelace");
 *
 * const fullName = derive(
 *   (get) => `${get(firstName)} ${get(lastName)}`,
 * );
 *
 * console.log(fullName.get()); // "Ada Lovelace"
 *
 * lastName.set("Byron");
 * console.log(fullName.get()); // "Ada Byron"
 * ```
 *
 * @example Conditional dependencies: only the active branch is tracked
 * ```ts
 * const toggle = createStore(true);
 * const a = createStore("A");
 * const b = createStore("B");
 *
 * // When toggle is true the derived store only depends on `toggle` and `a`.
 * // Changing `b` will NOT trigger a recompute.
 * const result = derive((get) => get(toggle) ? get(a) : get(b));
 * ```
 *
 * @example Subscribing to changes
 * ```ts
 * const price = createStore(100);
 * const taxed = derive((get) => get(price) * 1.2);
 *
 * const unsubscribe = taxed.subscribe(function (prevState) {
 *   console.log("price changed:", prevState, "->", this.get());
 * });
 *
 * price.set(200); // logs: price changed: 120 -> 240
 * unsubscribe();
 * ```
 *
 * @example Using `prev` to accumulate values (explicit type required)
 * ```ts
 * const delta = createStore(1);
 *
 * // Accumulates each delta into a running total.
 * const total = derive<number>((get, prev) => (prev() ?? 0) + get(delta));
 *
 * total.subscribe(function () {
 *   console.log(this.get());
 * });
 *
 * delta.set(5); // logs: 6  (0 + 1 + 5)
 * delta.set(3); // logs: 9  (6 + 3)
 * ```
 *
 * @see {@link https://github.com/zustandjs/derive-zustand} (original inspiration)
 */
export function derive<TState>(
  compute: ComputeFn<TState>,
): DerivedStore<TState> {
  let state: TState | undefined;
  let isInvalidated = true;
  let isDestroyed = false;
  let isNotifying = false;
  let dependencies: Map<ReadonlyStore, unknown> | undefined;
  let listeners = new Set<Listener<TState>>();
  const subscriptions = new Map<ReadonlyStore, VoidFunction>();

  function checkDestroyed(): void | never {
    if (isDestroyed) throwError("The store has been destroyed");
  }

  function invalidate(): void {
    if (isInvalidated) return;

    isInvalidated = true;
    const prevState = state!;

    const wasNotifying = isNotifying;
    isNotifying = true;
    try {
      for (const listener of listeners) {
        listener.call(store, prevState);
      }
    } finally {
      isNotifying = wasNotifying;
    }
  }

  function anyDependencyChanged(): boolean {
    for (const store of dependencies!.keys()) {
      if (!Object.is(store.get(), dependencies!.get(store))) return true;
    }

    return false;
  }

  function get(): TState {
    checkDestroyed();

    if (!isInvalidated) return state!;

    if (!dependencies || anyDependencyChanged()) {
      const newDependencies = new Map<ReadonlyStore<unknown>, unknown>();

      const getter: Getter = <T>(store: ReadonlyStore<T>) => {
        const s = store.get();
        newDependencies.set(store, s);
        return s;
      };

      state = compute(getter, () => state);
      dependencies = newDependencies;
    }

    if (listeners.size > 0) {
      // Remove unneeded subscriptions.
      for (const store of subscriptions.keys()) {
        if (!dependencies.has(store)) {
          subscriptions.get(store)!();
          subscriptions.delete(store);
        }
      }

      // Add new subscriptions.
      for (const store of dependencies.keys()) {
        if (!subscriptions.has(store)) {
          subscriptions.set(store, store.subscribe(invalidate));
        }
      }

      isInvalidated = false;
    }

    return state!;
  }

  function subscribe(listener: Listener<TState>): VoidFunction {
    checkDestroyed();

    if (isNotifying) listeners = new Set(listeners);
    listeners.add(listener);

    // Trigger read to establish dependencies if this is the first subscriber.
    if (listeners.size === 1) get();

    return () => {
      if (isNotifying) listeners = new Set(listeners);
      listeners.delete(listener);
      if (listeners.size === 0) clearDependencies();
    };
  }

  function clearDependencies(): void {
    for (const unsubscribe of subscriptions.values()) unsubscribe();
    subscriptions.clear();
    dependencies = undefined;
    isInvalidated = true;
  }

  function destroy(): void {
    checkDestroyed();

    listeners.clear();
    clearDependencies();
    isDestroyed = true;
  }

  const store: DerivedStore<TState> = {
    destroy,
    get,
    subscribe,
  };

  return store;
}
