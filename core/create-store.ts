// deno-lint-ignore-file no-explicit-any ban-types
import { throwError } from "./_internals.ts";
import type { Methods, NestedMethods } from "./_types.ts";

export type { Methods, NestedMethods };

/**
 * A function passed to {@linkcode Store.set} that computes the next state
 * from the previous one, instead of replacing it outright.
 *
 * @template TState The type of the state being updated.
 *
 * @example
 * ```ts
 * const store = createStore(0);
 * const increment: Updater<number> = (n) => n + 1;
 * store.set(increment);
 * ```
 */
export type Updater<TState> = (prev: TState) => TState;

/**
 * The listener callback passed to {@linkcode ReadonlyStore.subscribe}.
 *
 * Called with `this` bound to the store itself. A listener written with
 * regular function syntax can use `this.get()` without needing its own
 * reference to the store, useful for a listener defined outside the closure
 * that created it. An inline arrow-function listener ignores this binding
 * (arrow functions never rebind `this`), but typically doesn't need it: it
 * already has the store available through its enclosing closure/`this`.
 *
 * @template TState The type of the state this listener observes.
 * @template TStore The type of `this` inside the listener. Defaults to
 * {@linkcode ReadonlyStore}. A {@linkcode Store} passes itself, so a listener
 * subscribed to it can also call `this.set()`/`this.merge()`.
 *
 * @param prevState The previous state.
 *
 * @example Arrow function, reading the store from its enclosing closure
 * ```ts
 * const store = createStore({ count: 0 });
 * store.subscribe((prevState) => {
 *   console.log("prev:", prevState.count, "next:", store.get().count);
 * });
 * ```
 *
 * @example Regular function, reading the store via `this`
 * ```ts
 * const store = createStore({ count: 0 });
 * store.subscribe(function (prevState) {
 *   console.log("prev:", prevState.count, "next:", this.get().count);
 * });
 * ```
 */
export type Listener<
  TState,
  TStore extends ReadonlyStore<TState> = ReadonlyStore<TState>,
> = (
  this: TStore,
  prevState: TState,
) => void;

/**
 * The read-only surface of a {@linkcode Store}: `get` and `subscribe`, but no
 * `set`.
 *
 * APIs that only need to read a store, such as `derive`'s `get` helper or
 * React's `useStore`, should accept `ReadonlyStore` so both plain and
 * derived stores can be passed in.
 *
 * @template TState The type of the state held by this store.
 */
export interface ReadonlyStore<TState = unknown> {
  /**
   * Returns the current state of the store.
   */
  get(): TState;

  /**
   * Registers a listener that gets called when the state changes.
   *
   * Returns a function that can be called to unsubscribe the listener.
   *
   * `listener` is called with `this` bound to the store, see
   * {@linkcode Listener}.
   *
   * @example
   * ```ts
   * const store = createStore({ count: 0 });
   *
   * const unsubscribe = store.subscribe((prevState) => {
   *   console.log("prev:", prevState.count, "next:", store.get().count);
   * });
   *
   * store.set({ count: 1 }); // logs: prev: 0 next: 1
   *
   * unsubscribe(); // stop listening
   * store.set({ count: 2 }); // no log
   * ```
   */
  subscribe(listener: Listener<TState, this>): VoidFunction;
}

/**
 * The optional lifecycle hooks a {@linkcode StorePlugin} may return alongside
 * its methods.
 *
 * `onActivated`/`onDestroy` are reserved keys: a plugin cannot define an
 * actual callable method literally named `onActivated` or `onDestroy`.
 */
export type LifecycleHooks = {
  /**
   * Called once, synchronously, right after this plugin's methods have been
   * attached to the store (so it can call its own and any earlier plugin's
   * methods via `this`).
   */
  onActivated?(): void;

  /**
   * Called when {@linkcode Store.destroy} runs, in plugin registration
   * order, before the store is marked destroyed (so it can still call
   * `get`/`set`/methods during its own cleanup).
   */
  onDestroy?(): void;
};

type WithNamespace<
  TNamespace extends string | undefined,
  TPluginMethods extends Methods,
> = TNamespace extends string ? Record<TNamespace, TPluginMethods>
  : TPluginMethods;

/**
 * The object a {@linkcode StorePlugin} is: its own methods plus the optional
 * {@linkcode LifecycleHooks}.
 *
 * Carries a {@linkcode ThisType} marker so that inside every method (and
 * `onActivated`/`onDestroy`), `this` is typed as the full store, including
 * this plugin's own methods and every earlier plugin's. This is what lets a
 * method call a sibling method (`this.otherMethod()`) or an earlier plugin's
 * method (`this.earlierMethod()`, or `this.<namespace>.method()` for a
 * namespaced one) without a plugin needing its own store reference at all.
 * `this` is bound to the actual store object at call time, so this is not
 * just a type-level convenience, it works at runtime too. Methods written as
 * arrow functions don't get this binding (arrow functions ignore `this`
 * rebinding); use regular method syntax (`method() {}`) for anything that
 * needs `this`.
 *
 * @template TState The store's state type.
 * @template TStoreMethods The methods already on the store before this
 * plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, plugin)`,
 * or `undefined` for a top-level plugin.
 * @template TPluginMethods The methods this plugin itself contributes.
 */
export type PluginBody<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TPluginMethods extends Methods,
> =
  & TPluginMethods
  & LifecycleHooks
  & ThisType<
    Store<TState, TStoreMethods & WithNamespace<TNamespace, TPluginMethods>>
  >;

/**
 * A {@linkcode StorePlugin} written as a factory: a function that receives
 * the store and returns its {@linkcode PluginBody}.
 *
 * Only needed for a *parameterized* plugin (e.g. `persist(options)`) that
 * must stay generic over `TState` until `.use()` actually supplies a store:
 * TypeScript can't infer a plain object's `TState` (it's only visible inside
 * the {@linkcode ThisType} marker, which type inference doesn't look
 * through), but it can infer it from a function parameter. The `store`
 * parameter exists purely for this: `this` inside the returned body still
 * works exactly the same way, bound to the same store.
 *
 * @template TState The store's state type.
 * @template TStoreMethods The methods already on the store before this
 * plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, plugin)`,
 * or `undefined` for a top-level plugin.
 * @template TPluginMethods The methods this plugin itself contributes.
 */
export type StorePluginFactory<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TPluginMethods extends Methods = {},
> = (
  store: Store<TState, TStoreMethods>,
) => PluginBody<TState, TStoreMethods, TNamespace, TPluginMethods>;

/**
 * A plugin registered via {@linkcode Store.use}: a plain object of methods
 * plus optional lifecycle hooks, with no store reference of its own; every
 * method (and `onActivated`/`onDestroy`) reaches the store through `this`.
 * This is the shape every official plugin (`persist`, `history`, `immer`,
 * ...) actually returns, parameterized ones included.
 *
 * The {@linkcode StorePluginFactory} branch of this union exists only so
 * TypeScript can infer `TState` for a *parameterized* plugin factory (e.g.
 * `persist<TState, ...>(options): StorePlugin<TState, ...>`), a plain
 * object can't carry `TState` for inference purposes: it's only visible
 * inside the {@linkcode ThisType} marker below, and TypeScript's inference
 * doesn't look through `ThisType` when resolving a generic call's type
 * parameters. A real function parameter is a normal structural position
 * inference does look at, so once `StorePlugin`'s declared type includes
 * that branch, `TState` infers correctly at the `.use()` call site, even
 * when, as with every plugin in this package, the implementation never
 * actually returns a function and always returns a plain object instead.
 * Only the *declared* return type participates in the caller's inference;
 * the actual returned value only has to be assignable to it. A plugin
 * author who does want an explicit `store` reference (e.g. heavy
 * arrow-function use, where `this` doesn't rebind) can still return a
 * `StorePluginFactory` for real; nothing else changes.
 *
 * @template TState The store's state type.
 * @template TStoreMethods The methods already on the store before this
 * plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, plugin)`,
 * or `undefined` for a top-level plugin. Inferred automatically.
 * @template TPluginMethods The methods this plugin contributes. Inferred
 * automatically.
 *
 * @example A plugin whose own method calls a sibling method via `this`
 * ```ts
 * type CounterMethods = {
 *   increment(amount: number): void;
 *   incrementTwice(amount: number): void;
 * };
 *
 * // The 4th type argument (the plugin's own methods) must be given
 * // explicitly here since there's no `.use()` call for it to be inferred
 * // from; omitting it defaults to `{}`, which would reject every method
 * // below as an excess property.
 * const counter: StorePlugin<{ count: number }, {}, undefined, CounterMethods> = {
 *   onActivated() {
 *     console.log("activated with", this.get().count);
 *   },
 *   increment(amount: number): void {
 *     this.merge((s) => ({ count: s.count + amount }));
 *   },
 *   incrementTwice(amount: number): void {
 *     this.increment(amount);
 *     this.increment(amount);
 *   },
 * };
 * ```
 */
export type StorePlugin<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TPluginMethods extends Methods = {},
> =
  | PluginBody<TState, TStoreMethods, TNamespace, TPluginMethods>
  | StorePluginFactory<TState, TStoreMethods, TNamespace, TPluginMethods>;

/**
 * A reactive state container that holds a value of type `TState`, optionally
 * extended with plugin-contributed methods.
 *
 * Use {@linkcode createStore} to create one.
 *
 * @example Basic usage
 * ```ts
 * const counter = createStore(0);
 *
 * counter.subscribe((prevState) => {
 *   console.log("changed from", prevState, "to", counter.get());
 * });
 *
 * counter.set(1); // logs: changed from 0 to 1
 * counter.set((n) => n + 1); // logs: changed from 1 to 2
 * ```
 *
 * @example Adding capability with `.use()`
 * ```ts
 * const store = createStore({ count: 0 }).use({
 *   increment(amount: number): void {
 *     this.merge((s) => ({ count: s.count + amount }));
 *   },
 * });
 *
 * store.increment(5);
 * console.log(store.get()); // { count: 5 }
 * ```
 *
 * @template TState The type of the state held by this store.
 * @template TStoreMethods The methods registered on this store via `.use()`
 * so far.
 */
export type Store<TState = unknown, TStoreMethods extends NestedMethods = {}> =
  & ReadonlyStore<TState>
  & {
    /**
     * Sets the state of the store and notifies listeners.
     * @param next The next state or a function that computes the next state.
     */
    set(next: TState | Updater<TState>): void;

    /**
     * Shallow-merges `partial` into the current state and notifies
     * listeners.
     *
     * Always notifies, even if no value changed, because the merged state is
     * a new object.
     *
     * Meant for object-shaped state; merging into a primitive or array store
     * isn't meaningful.
     *
     * @param partial An object to merge into the current state, or a
     * function that computes it from the current state.
     *
     * @example
     * ```ts
     * const store = createStore({ count: 0, name: "a" });
     *
     * store.merge({ count: 1 });
     * console.log(store.get()); // { count: 1, name: "a" }
     *
     * store.merge((s) => ({ count: s.count + 1 }));
     * console.log(store.get()); // { count: 2, name: "a" }
     * ```
     */
    merge(
      partial: Partial<TState> | ((state: TState) => Partial<TState>),
    ): void;

    /**
     * Destroys the store, removing all registered listeners and invoking
     * every registered {@linkcode LifecycleHooks.onDestroy onDestroy} hook,
     * in registration order.
     *
     * Calling `destroy()` more than once is safe and does nothing after the
     * first call. Calling any other method (`get`, `set`, `merge`,
     * `subscribe`, `use`, or a method added by a plugin) after `destroy()`
     * throws.
     */
    destroy(): void;

    /**
     * Registers a top-level plugin.
     *
     * A plugin is a plain object of methods plus optional `onActivated`/
     * `onDestroy` hooks, with `this` bound to the store inside every one.
     * Methods are attached directly to the store, callable as
     * `store.<name>(...)`.
     *
     * @example
     * ```ts
     * const store = createStore({ count: 0 }).use({
     *   increment(amount: number): void {
     *     this.merge((s) => ({ count: s.count + amount }));
     *   },
     * });
     *
     * store.increment(5);
     * ```
     */
    use<TPluginMethods extends Methods = {}>(
      plugin: StorePlugin<TState, TStoreMethods, undefined, TPluginMethods>,
    ): Store<TState, TStoreMethods & TPluginMethods>;

    /**
     * Registers a plugin under a namespace.
     *
     * The plugin's methods are accessible at `store.<namespace>.<name>`. An
     * error is thrown if the namespace is already taken by another plugin.
     *
     * @example
     * ```ts
     * const store = createStore({ items: [] as string[] })
     *   .use("list", {
     *     add(item: string): void {
     *       this.merge((s) => ({ items: [...s.items, item] }));
     *     },
     *   });
     *
     * store.list.add("hello");
     * ```
     */
    use<TNamespace extends string, TPluginMethods extends Methods = {}>(
      namespace: TNamespace,
      plugin: StorePlugin<TState, TStoreMethods, TNamespace, TPluginMethods>,
    ): Store<TState, TStoreMethods & Record<TNamespace, TPluginMethods>>;
  }
  & TStoreMethods;

/**
 * Creates a reactive state store: `get`/`set`/`merge`/`subscribe`, plus
 * `.use()` to add capability (methods, lifecycle hooks, namespacing).
 *
 * Plugins registered later can call earlier plugins' methods (and their own
 * sibling methods) via `this`, see {@linkcode StorePlugin}.
 *
 * @param initialState The initial state of the store.
 * @returns A {@linkcode Store} instance.
 *
 * @example Minimal store
 * ```ts
 * const store = createStore({ count: 0 });
 *
 * store.set({ count: 1 });
 * console.log(store.get()); // { count: 1 }
 * ```
 *
 * @example Functional update
 * ```ts
 * const store = createStore(0);
 * store.set((n) => n + 1);
 * console.log(store.get()); // 1
 * ```
 */
export function createStore<TState>(initialState: TState): Store<TState> {
  let state = initialState;
  let listeners = new Set<Listener<TState, Store<TState>>>();
  let isNotifying = false;
  let isDestroyed = false;
  const onDestroyCallbacks: VoidFunction[] = [];

  function checkDestroyed(): void | never {
    if (isDestroyed) throwError("The store has been destroyed");
  }

  function get(): TState {
    checkDestroyed();
    return state;
  }

  function set(next: TState | Updater<TState>): void {
    checkDestroyed();

    const prevState = state;
    state = typeof next === "function"
      ? (next as Updater<TState>)(prevState)
      : next;
    if (Object.is(state, prevState)) return;

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

  function merge(
    partial: Partial<TState> | ((state: TState) => Partial<TState>),
  ): void {
    checkDestroyed();
    const current = state;
    const p = typeof partial === "function" ? partial(current) : partial;
    set({ ...current, ...p });
  }

  function subscribe(listener: Listener<TState, Store<TState>>): VoidFunction {
    checkDestroyed();
    if (isNotifying) listeners = new Set(listeners);
    listeners.add(listener);
    return () => {
      if (isNotifying) listeners = new Set(listeners);
      listeners.delete(listener);
    };
  }

  function destroy(): void {
    if (isDestroyed) return;
    for (const callback of onDestroyCallbacks) callback.call(store);
    isDestroyed = true;
  }

  function addMethods(target: Record<string, unknown>, body: Methods): void {
    for (const name of Object.keys(body)) {
      if (Object.hasOwn(target, name)) {
        throwError(
          `Failed to add method "${name}". A member with the same name already exists.`,
        );
      }

      const method = body[name];

      target[name] = (...args: unknown[]) => {
        checkDestroyed();
        return method.apply(store, args);
      };
    }
  }

  function use(
    namespaceOrPlugin: string | StorePlugin<TState, any, any>,
    plugin?: StorePlugin<TState, any, any>,
  ): typeof store {
    checkDestroyed();

    const p = typeof namespaceOrPlugin === "string"
      ? plugin!
      : namespaceOrPlugin;
    const ns = typeof namespaceOrPlugin === "string"
      ? namespaceOrPlugin
      : undefined;

    if (ns && Object.hasOwn(store, ns)) {
      throwError(
        `Another plugin has already been registered under the namespace "${ns}"`,
      );
    }

    const body = typeof p === "function" ? p(store) : p;
    const { onActivated, onDestroy, ...methods } = body;

    type R = Record<string, unknown>;

    const target = ns ? (((store as R)[ns] ??= {}) as R) : (store as R);

    addMethods(target, methods);

    onActivated?.call(store);

    if (onDestroy) onDestroyCallbacks.push(onDestroy);

    return store;
  }

  const store = {
    get,
    set,
    merge,
    subscribe,
    use,
    destroy,
  };

  return store;
}
