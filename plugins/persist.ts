import {
  isPlainObject,
  type NestedMethods,
  type Store,
  type StorePlugin,
} from "@kintools/store-core";

type PromiseOr<T> = Promise<T> | T;

/**
 * A storage backend compatible with the persist plugin.
 *
 * The interface intentionally mirrors the Web Storage API (`localStorage`,
 * `sessionStorage`) so those can be used directly. Any storage that
 * satisfies this contract, including async ones (e.g. IndexedDB wrappers),
 * is accepted.
 *
 * @example Using a custom async storage
 * ```ts
 * const asyncStorage: PersistStorage = {
 *   async getItem(key: string): Promise<string | null> {
 *     return await myDB.get(key);
 *   },
 *   async setItem(key: string, value: string): Promise<void> {
 *     await myDB.set(key, value);
 *   },
 *   async removeItem(key: string): Promise<void> {
 *     await myDB.delete(key);
 *   },
 * };
 * ```
 */
export type PersistStorage = {
  getItem(key: string): PromiseOr<string | null>;
  removeItem(key: string): PromiseOr<void>;
  setItem(key: string, value: string): PromiseOr<void>;
};

/**
 * The value stored in the storage backend.
 *
 * Wraps the persisted state together with a schema version number so that
 * {@linkcode PersistOptions.migrate} can detect and handle breaking changes.
 *
 * @template TSlice The type of the persisted state slice (see
 * {@linkcode PersistOptions.selector}).
 */
export type StorageValue<TSlice> = {
  value: TSlice;
  version: number;
};

/**
 * Options for the {@linkcode persist} plugin.
 *
 * @template TState The store's full state type.
 * @template TSlice The slice of state that is actually persisted. Defaults to
 * the full state when no {@linkcode PersistOptions.selector selector} is
 * provided.
 */
export type PersistOptions<TState, TSlice = TState> = {
  /**
   * The key used to read and write the state in the storage backend.
   */
  key: string;

  /**
   * The storage backend. Defaults to {@linkcode localStorage}.
   */
  storage?: PersistStorage;

  /**
   * Selects the slice of state to persist. By default the entire state is
   * stored, but you can pass a selector to persist only a subset:
   *
   * ```ts
   * // Only persist the auth token, not transient UI state.
   * selector: (state) => ({ token: state.auth.token }),
   * ```
   */
  selector?: (state: TState) => TSlice;

  /**
   * Merges the hydrated slice back into the current state. Called after a
   * successful storage read, before applying the restored state.
   *
   * Defaults to a shallow merge (`{ ...current, ...slice }`), which works
   * correctly when {@linkcode PersistOptions.selector selector} returns a
   * partial object. When the current state is an array, the default instead
   * replaces it outright with `slice`: object-spreading an array produces a
   * plain object with numeric keys, not an array, which would silently break
   * any array state. Pass a custom `merge` (e.g. `(current, slice) =>
   * [...current, ...slice]`) if array state needs different merge semantics.
   *
   * @param current The store's live state at the moment of hydration.
   * @param slice The value read from storage (after migration, if any).
   */
  merge?: (current: TState, slice: TSlice) => TState;

  /**
   * Schema version for the stored state. Defaults to `0`.
   *
   * When the stored version differs from this value,
   * {@linkcode PersistOptions.migrate migrate} is called (if provided).
   * If `migrate` is not provided and the versions differ, the stored value is
   * discarded and the store keeps its default state.
   */
  version?: number;

  /**
   * Called when the stored version does not match
   * {@linkcode PersistOptions.version}. Receives the raw stored state and the
   * stored version number. Must return the migrated state (or a promise of it).
   *
   * @example
   * ```ts
   * migrate(stored: TSlice, version: number): TSlice {
   *   if (version === 0) return { ...stored, newField: "default" };
   *   return stored;
   * },
   * ```
   */
  migrate?: (stored: TSlice, version: number) => PromiseOr<TSlice>;

  /**
   * Encodes a {@linkcode StorageValue} to the string written to storage.
   * Defaults to {@linkcode JSON.stringify}.
   */
  encode?: (value: StorageValue<TSlice>) => string;

  /**
   * Decodes the string read from storage back into a {@linkcode StorageValue}.
   * Return `null` to signal that the stored value should be ignored.
   * Defaults to {@linkcode JSON.parse}.
   */
  decode?: (raw: string) => StorageValue<TSlice> | null;

  /**
   * When `true`, the plugin does **not** rehydrate from storage on activation.
   * Call `store.<namespace>.hydrate()` manually when ready (e.g. after
   * server-side rendering finishes).
   *
   * @default false
   */
  skipHydration?: boolean;
};

type PersistMethods<TState> = {
  /**
   * Returns a promise that settles once the current or most recent hydration
   * completes: it resolves on success and rejects with the error that caused
   * the hydration to fail. If no hydration is in progress and the store has
   * already hydrated successfully, resolves immediately.
   *
   * Useful for coordinating with other plugins (e.g. `history`) that
   * need to re-baseline their state after the persisted value is loaded:
   *
   * ```ts
   * await store.persist.hydrationComplete();
   * store.history.rebase();
   * ```
   */
  hydrationComplete(): Promise<void>;

  /**
   * Returns `true` synchronously if at least one hydration has completed
   * successfully. Useful for conditional rendering without `await`.
   */
  hasHydrated(): boolean;

  /**
   * Triggers a fresh read from storage and applies the result to the store.
   * If a hydration is already in progress, returns its promise instead of
   * starting a new one: concurrent callers share the same read.
   *
   * Required when {@linkcode PersistOptions.skipHydration} is `true`.
   */
  hydrate(): Promise<void>;

  /**
   * Removes the persisted state from storage.
   *
   * This does **not** reset the in-memory store state. Call a reset action
   * separately if you also want to revert the live state.
   */
  clear(): PromiseOr<void>;

  /**
   * Registers a listener called at the **start** of each hydration, before
   * the storage read. Receives the store's current (pre-hydration) state.
   *
   * Returns an unsubscribe function.
   */
  onHydrationStart(cb: (state: TState) => void): () => void;

  /**
   * Registers a listener called when a hydration **completes** successfully.
   * Receives the store's state after hydration.
   *
   * Returns an unsubscribe function.
   */
  onHydrationComplete(cb: (state: TState) => void): () => void;
};

/**
 * Creates a plugin that persists and hydrates the store state using a storage backend.
 *
 * On activation, the plugin reads any previously stored value, merges it with
 * the current state, and applies it via `store.set()`. It then subscribes to
 * the store and writes every state change to storage.
 *
 * @param options Persistence options.
 * The namespace is provided automatically via `store.use(namespace, persist(options))`.
 *
 * @example Persist entire state with localStorage (default)
 * ```ts
 * const store = createStore({ count: 0 })
 *   .use({
 *     increment(n: number): void {
 *       this.merge((s) => ({ count: s.count + n }));
 *     },
 *   })
 *   .use("persist", persist({ key: "my-counter" }));
 *
 * store.increment(1);
 * await store.persist.clear();
 * ```
 *
 * @example Persist a slice of state
 * ```ts
 * const store = createStore({ token: "", theme: "light", count: 0 })
 *   .use("persist", persist({
 *     key: "app",
 *     selector: (s) => ({ token: s.token }),
 *     merge: (current, slice) => ({ ...current, ...slice }),
 *   }));
 * ```
 *
 * @example Schema versioning with migration
 * ```ts
 * const store = createStore({ items: [] as Item[] })
 *   .use("persist", persist({
 *     key: "items",
 *     version: 1,
 *     migrate(stored, version) {
 *       if (version === 0) return { items: stored.todos ?? [] };
 *       return stored;
 *     },
 *   }));
 * ```
 *
 * @example SSR: skip auto-hydration and trigger manually
 * ```ts
 * const store = createStore({ user: null })
 *   .use("persist", persist({ key: "user", skipHydration: true }));
 *
 * // Later, on the client:
 * await store.persist.hydrate();
 * ```
 *
 * @template TState The store's state type.
 * @template TStoreMethods Methods already on the store before this plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, persist(...))`,
 * or `undefined` for top-level. Inferred automatically.
 * @template TSlice The slice of state that is persisted. Defaults to `TState`.
 */
export function persist<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TSlice = TState,
>(
  options: PersistOptions<TState, TSlice>,
): StorePlugin<TState, TStoreMethods, TNamespace, PersistMethods<TState>> {
  const {
    key,
    storage,
    selector = (s: TState) => s as unknown as TSlice,
    merge = (current: TState, slice: TSlice) =>
      isPlainObject(current)
        ? ({ ...current, ...slice } as TState)
        : (slice as unknown as TState),
    version: targetVersion = 0,
    migrate,
    encode = JSON.stringify,
    decode = JSON.parse,
    skipHydration = false,
  } = options;

  // Resolved lazily (not as a default parameter) so constructing the plugin
  // never touches the `localStorage` global. Environments without it (SSR)
  // only fail if a hydration/write actually runs without a custom `storage`.
  function getStorage(): PersistStorage {
    return storage ?? localStorage;
  }

  let _hasHydrated = false;
  let _hydrating = false;
  let resolveActive!: () => void;
  let rejectActive!: (e: unknown) => void;
  // Always initialized so hydrationComplete() has a real promise to await
  // before any hydration starts. Once a round settles, this promise is left
  // in place (resolved or rejected) so hydrationComplete() keeps reporting
  // that round's outcome until the next startHydration() call replaces it.
  let activeHydration = new Promise<void>((res, rej) => {
    resolveActive = res;
    rejectActive = rej;
  });

  const onHydrationStartListeners = new Set<(state: TState) => void>();
  const onHydrationCompleteListeners = new Set<(state: TState) => void>();

  async function _hydrate(store: Store<TState, TStoreMethods>): Promise<void> {
    onHydrationStartListeners.forEach((cb) => cb(store.get()));

    try {
      let raw = getStorage().getItem(key);
      if (raw instanceof Promise) raw = await raw;

      if (raw) {
        let storedValue: StorageValue<TSlice> | undefined;

        try {
          storedValue = decode(raw);
        } catch {
          // Corrupted storage value, skip restore.
        }

        let slice: TSlice | undefined;

        if (storedValue) {
          if (storedValue.version === targetVersion) {
            slice = storedValue.value;
          } else if (migrate) {
            slice = await migrate(storedValue.value, storedValue.version);
          }

          if (slice !== undefined) {
            store.set(merge(store.get(), slice));
          }
        }
      }

      _hasHydrated = true;
      onHydrationCompleteListeners.forEach((cb) => cb(store.get()));
      resolveActive();
    } catch (e) {
      // Reported to callers via activeHydration; not rethrown, since
      // _hydrate()'s own returned promise has no consumer of its own.
      rejectActive(e);
    }
  }

  function startHydration(store: Store<TState, TStoreMethods>): Promise<void> {
    if (!_hydrating) {
      // Fresh attempt: a new promise so hydrationComplete() tracks this
      // round instead of the previous one's already-settled outcome.
      activeHydration = new Promise<void>((res, rej) => {
        resolveActive = res;
        rejectActive = rej;
      });
      _hydrating = true;
      _hydrate(store).finally(() => {
        _hydrating = false;
      });
    }
    return activeHydration;
  }

  return {
    async onActivated() {
      if (!skipHydration) {
        try {
          // `this`'s type has more methods than TStoreMethods (this plugin's
          // own), which TS can't prove is still assignable through the
          // generic Store<TState, TStoreMethods> alias; safe in practice,
          // since startHydration only reads get/set, present regardless.
          await startHydration(this as Store<TState, TStoreMethods>);
        } catch {
          // Failures surface through hasHydrated()/hydrationComplete();
          // swallow here so they don't become an unhandled rejection.
          // onActivated is called without awaiting or attaching a catch.
        }
      }

      this.subscribe(() => {
        try {
          getStorage().setItem(
            key,
            encode({ value: selector(this.get()), version: targetVersion }),
          );
        } catch {
          // Storage errors must not crash the app.
        }
      });
    },
    clear() {
      return getStorage().removeItem(key);
    },
    hasHydrated() {
      return _hasHydrated;
    },
    hydrate() {
      return startHydration(this as Store<TState, TStoreMethods>);
    },
    hydrationComplete() {
      return activeHydration;
    },
    onHydrationStart(cb: (state: TState) => void) {
      onHydrationStartListeners.add(cb);
      return () => onHydrationStartListeners.delete(cb);
    },
    onHydrationComplete(cb: (state: TState) => void) {
      onHydrationCompleteListeners.add(cb);
      return () => onHydrationCompleteListeners.delete(cb);
    },
  };
}
