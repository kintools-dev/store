# Changelog

## 0.3.1

- Renamed from `@kin-store/core` to `@kintools/store-core`, matching Kin
  Form's `@kintools/<project>-<thing>` scheme. Now also published to npm
  (via `scripts/build-npm.ts`, using dnt), with the npm package marked
  `sideEffects: false` so bundlers can safely tree-shake unused exports.
- Refreshed README bundle-size figures using a rolldown-based measurement
  (`scripts/bundle-size.ts`) and realigned the README's positioning and step
  order with the docs site.

## 0.3.0

- **Breaking:** `MergeReducers` is no longer exported. It was only ever needed
  to hand-reconstruct the store type seen inside a plugin's own
  `methods`/`onActivated`/`onDestroy`; use the new `PluginStore` helper
  instead, which does that merge for you.
- Add `PluginStore`, a helper type for the store seen inside a plugin's own
  `methods`/`onActivated`/`onDestroy`. `StorePlugin` and `getPluginDispatch`
  now use it internally instead of reconstructing it from `MergeReducers` and
  `StoreWithPlugins`.
- Fix `getPluginDispatch`'s return type: `TPluginReducers` is now inferred
  structurally from the store's own type instead of needing to be supplied by
  the caller, so call sites no longer need an `as InferActions<...>` cast to
  get fully-typed action callers.
- Export a bare `.` package specifier (`@kin-store/core`) alongside
  `./index.ts`.

## 0.2.3

- Document previously undocumented public symbols: `ReadonlyStore`,
  `Canceled`, `Methods`, `NestedMethods`. Export and document `Updater`
  (`createStore`) and `Getter`/`ComputeFn` (`derive`), which were referenced
  from public types without being exported themselves. Add a `@module` doc to
  `core/index.ts`.

## 0.2.2

- Add a `ReadonlyStore` base type (`get`/`subscribe`) that `Store` extends with
  `set`. `derive`, `useSelector`/`useSelectorWithEquality`, and
  `StoreProvider`/`useStoreContext` now accept `ReadonlyStore` instead of
  `Store`, so a `DerivedStore` can be passed anywhere a read-only store is
  expected, including as a source for another `derive()`, which previously
  didn't type-check.

## 0.2.1

- Fix `use()` type inference: without default type parameters, TypeScript fell
  back to the full `Reducers<TState>`/`Methods` constraint (instead of `{}`)
  when a plugin contributed no reducers/methods, so invalid
  `store.dispatch.<name>()`, `store.<name>()` calls went unflagged.

## 0.2.0

- Refactor `getState`/`setState` to `get`/`set`.

## 0.1.0

- Initial release.
