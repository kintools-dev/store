import type { NestedMethods, StorePlugin } from "@kintools/store-core";

/**
 * Options accepted by {@linkcode history}.
 */
export type HistoryOptions = {
  /**
   * Maximum number of snapshots to keep. When exceeded, the oldest snapshot is
   * dropped. Defaults to unlimited.
   */
  limit?: number;
};

type HistoryMethods = {
  /** Returns `true` if there is a future state to redo. */
  canRedo(): boolean;

  /** Returns `true` if there is a past state to undo. */
  canUndo(): boolean;

  /**
   * Discards all history and makes the current state the new undo floor.
   * Useful after async hydration so that `undo` and `reset` do not step back
   * to the pre-hydration state.
   *
   * @example
   * ```ts
   * await store.persist.hydrationComplete();
   * store.history.rebase();
   * ```
   */
  rebase(): void;

  /**
   * Moves forward one step. Returns `true` if the move happened, `false` if
   * already at the latest state.
   */
  redo(): boolean;

  /**
   * Resets the store to the baseline state and clears the history.
   *
   * When a `limit` is set, the baseline is the earliest *remembered* state,
   * not necessarily the original initial state.
   */
  reset(): void;

  /**
   * Moves back one step. Returns `true` if the move happened, `false` if
   * already at the earliest state.
   */
  undo(): boolean;
};

/**
 * Creates a plugin that tracks state history and enables undo / redo / reset.
 *
 * Every state change is recorded, however it happens (`store.set()`,
 * `store.merge()`, or any plugin method), because the plugin records via
 * `store.subscribe` rather than hooking any particular write path.
 *
 * Pass `{ limit }` to cap memory use in apps with frequent state changes.
 * Once the limit is reached, the oldest snapshot is dropped on each new change.
 *
 * @remarks When used together with
 * {@linkcode import("./persist.ts").persist persist}, place this plugin after
 * `persist`. If `persist` uses an async storage,
 * {@linkcode HistoryMethods.rebase rebase} is needed to set the hydrated
 * state as the new baseline.
 *
 * @example Basic usage
 * ```ts
 * const store = createStore({ count: 0 })
 *   .use({
 *     increment(n: number): void {
 *       this.merge((s) => ({ count: s.count + n }));
 *     },
 *   })
 *   .use("history", history());
 *
 * store.increment(1); // count = 1
 * store.increment(1); // count = 2
 *
 * store.history.canUndo(); // true
 * store.history.undo();    // count = 1
 * store.history.redo();    // count = 2
 * store.history.reset();   // count = 0
 * ```
 *
 * @template TState The store's state type.
 * @template TStoreMethods Methods already on the store before this plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, history())`,
 * or `undefined` for top-level. Inferred automatically.
 */
export function history<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(
  options: HistoryOptions = {},
): StorePlugin<TState, TStoreMethods, TNamespace, HistoryMethods> {
  const { limit = Infinity } = options;
  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  function canUndo(): boolean {
    return index > 0;
  }

  function canRedo(): boolean {
    return index + 1 < snapshots.length;
  }

  return {
    onActivated() {
      snapshots.push(this.get());

      this.subscribe(() => {
        if (isRestoring) return;

        snapshots.length = index + 1;
        snapshots.push(this.get());
        if (snapshots.length > limit) {
          snapshots.shift();
        }
        index = snapshots.length - 1;
      });
    },

    canRedo,
    canUndo,

    redo(): boolean {
      if (!canRedo()) return false;

      isRestoring = true;
      this.set(snapshots[++index]);
      isRestoring = false;
      return true;
    },

    reset() {
      isRestoring = true;
      this.set(snapshots[0]);
      snapshots.length = 1;
      index = 0;
      isRestoring = false;
    },

    rebase() {
      snapshots[0] = this.get();
      snapshots.length = 1;
      index = 0;
    },

    undo(): boolean {
      if (!canUndo()) return false;

      isRestoring = true;
      this.set(snapshots[--index]);
      isRestoring = false;
      return true;
    },
  };
}
