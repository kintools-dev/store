// deno-lint-ignore-file ban-types
import type {
  LifecycleHooks,
  Methods,
  NestedMethods,
  PluginBody,
  Store,
  StorePlugin,
} from "@kintools/store-core";

import { type Draft, produce } from "immer";

/**
 * The store type seen inside an {@linkcode ImmerPlugin}: identical to
 * {@linkcode Store}, except `set` accepts an Immer recipe
 * `(draft) => void` instead of a full state replacement.
 *
 * Use this for state changes (`this.set((draft) => { draft.x = 1; })`).
 *
 * @template TState The store's state type.
 * @template TStoreMethods The methods already on the store before this
 * plugin is applied.
 */
export type ImmerStore<TState, TStoreMethods extends NestedMethods> =
  & Omit<Store<TState, TStoreMethods>, "set">
  & {
    set(recipe: (draft: Draft<TState>) => void): void;
  };

type WithNamespace<
  TNamespace extends string | undefined,
  TPluginMethods extends Methods,
> = TNamespace extends string ? Record<TNamespace, TPluginMethods>
  : TPluginMethods;

/**
 * A plugin written against an {@linkcode ImmerStore} instead of a plain
 * {@linkcode Store}: `this` inside every method (and `onActivated`/
 * `onDestroy`) has an Immer-recipe `set`. Pass one to {@linkcode immer} to
 * get back a standard {@linkcode StorePlugin}.
 *
 * @template TState The store's state type.
 * @template TStoreMethods The methods already on the store before this
 * plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, immer(...))`,
 * or `undefined` for top-level. Inferred automatically.
 * @template TPluginMethods The methods this plugin contributes. Inferred
 * automatically.
 */
export type ImmerPlugin<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TPluginMethods extends Methods = {},
> =
  & TPluginMethods
  & LifecycleHooks
  & ThisType<
    ImmerStore<
      TState,
      TStoreMethods & WithNamespace<TNamespace, TPluginMethods>
    >
  >;

function asImmerStore<TState, TStoreMethods extends NestedMethods>(
  store: Store<TState, TStoreMethods>,
): ImmerStore<TState, TStoreMethods> {
  return {
    ...(store as Omit<typeof store, "set">),
    set: (recipe: (draft: Draft<TState>) => void) =>
      store.set(produce(store.get(), recipe)),
  };
}

/**
 * Adapter that lets you write a plugin using
 * [Immer](https://immerjs.github.io/immer/) draft mutations instead of
 * returning new state objects.
 *
 * Pass an {@linkcode ImmerPlugin} to `immer()` and the returned value is a
 * standard {@linkcode StorePlugin} ready for `store.use()`: inside it, `this`
 * (and the store passed to any of its own helper functions) has a `set` that
 * accepts a recipe `(draft) => void` instead of a full state replacement.
 * Every method, `onActivated`, and `onDestroy` is individually wrapped so
 * `this` resolves to the Immer-flavored store no matter how it's reached
 * (externally, or via a sibling/earlier-plugin call through `this`).
 *
 * @param plugin A plugin written against an {@linkcode ImmerStore}.
 * @returns A standard {@linkcode StorePlugin} ready to pass to `store.use()`.
 *
 * @example Basic counter with Immer-based methods
 * ```ts
 * import { immer } from "@kintools/store-plugins";
 *
 * const store = createStore({ count: 0, items: [] as string[] }).use(
 *   immer({
 *     increment(amount: number): void {
 *       this.set((draft) => {
 *         draft.count += amount;
 *       });
 *     },
 *     addItem(item: string): void {
 *       this.set((draft) => {
 *         draft.items.push(item);
 *       });
 *     },
 *     reset(): void {
 *       this.set((draft) => {
 *         draft.count = 0;
 *         draft.items = [];
 *       });
 *     },
 *   }),
 * );
 *
 * store.increment(3);
 * store.addItem("hello");
 * store.reset();
 * ```
 *
 * @example Namespaced Immer plugin
 * ```ts
 * const store = createStore({ todos: [] as Todo[] }).use(
 *   "todos",
 *   immer({
 *     add(title: string): void {
 *       this.set((draft) => {
 *         draft.todos.push({ id: Date.now(), title, done: false });
 *       });
 *     },
 *     toggle(id: number): void {
 *       this.set((draft) => {
 *         const todo = draft.todos.find((t) => t.id === id);
 *         if (todo) todo.done = !todo.done;
 *       });
 *     },
 *   }),
 * );
 *
 * store.todos.add("Buy milk");
 * store.todos.toggle(someId);
 * ```
 *
 * @template TState The store's state type.
 * @template TStoreMethods Methods already on the store before this plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, immer(...))`,
 * or `undefined` for top-level. Inferred automatically.
 * @template TPluginMethods The methods contributed by this plugin.
 */
export function immer<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
  TPluginMethods extends Methods = {},
>(
  plugin: ImmerPlugin<TState, TStoreMethods, TNamespace, TPluginMethods>,
): StorePlugin<TState, TStoreMethods, TNamespace, TPluginMethods> {
  const wrapped: Record<string, unknown> = {};

  for (const name of Object.keys(plugin)) {
    const fn = plugin[name];
    wrapped[name] = function (
      this: Store<TState, TStoreMethods>,
      ...args: unknown[]
    ) {
      return fn.apply(asImmerStore(this), args);
    };
  }

  return wrapped as PluginBody<
    TState,
    TStoreMethods,
    TNamespace,
    TPluginMethods
  >;
}
