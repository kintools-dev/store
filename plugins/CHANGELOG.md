# Changelog

## 0.4.1

- Renamed from `@kin-store/plugins` to `@kintools/store-plugins`. Now also
  published to npm, with the npm package marked `sideEffects: false` so
  bundlers can safely tree-shake unused exports.

## 0.4.0

- Add `broadcast`, a plugin that syncs a store's entire state across browser
  tabs/windows via `BroadcastChannel`. Conflicts resolve last-write-wins by
  wall-clock time; a tab opened after others requests the current state on
  activation instead of waiting for the next change.

## 0.3.7

- Bump version to pick up `@kin-store/core` 0.3.0. `persist` and `immer` use
  the new `PluginStore` helper internally instead of `MergeReducers`; no
  public API change.
- Fix `history`/`persist`: drop the `as InferActions<...>` cast previously
  needed at each `getPluginDispatch` call site, now that its return type is
  inferred structurally (see `@kin-store/core` 0.3.0).
- Export a bare `.` package specifier (`@kin-store/plugins`) alongside
  `./index.ts`.

## 0.3.6

- Fix `persist`: `storage` fell back to the `localStorage` global through a
  default parameter, which is evaluated eagerly the moment `persist(options)`
  is called. Constructing the plugin without a custom `storage` crashed in
  SSR/build environments (no global `localStorage`) even with
  `skipHydration: true`. Storage is now resolved lazily, only when a
  hydration or write actually happens.
- Fix `persist`: a failed hydration could leak as an unhandled promise
  rejection out of `onActivated`, and `hydrationComplete()` would resolve as
  if hydration had succeeded once the failed attempt settled. `onActivated`
  now handles the failure internally, and `hydrationComplete()` keeps
  reflecting the last attempt's outcome (rejecting on failure) until the next
  hydration replaces it.

## 0.3.5

- Document previously undocumented `DevtoolsOptions` and `HistoryOptions`.
  Reword the `devtools`/`history`/`persist` plugin factory summaries to start
  with "Creates a plugin that ..." instead of "Plugin that ...", since the
  exported symbol is a factory, not a plugin instance. Fix `history`/`immer`/
  `persist`'s `@template` tags, which were stranded in a second JSDoc block
  that `deno doc` doesn't attach to the symbol. Add a `@module` doc to
  `plugins/index.ts`.

## 0.3.4

- Bump version to pick up `@kin-store/core` 0.2.2 dependency.

## 0.3.3

- Fix the same `use()` type inference issue in the `immer` plugin (see
  `@kin-store/core` 0.2.1).

## 0.3.2

- Fix JSR deployment issue due to version and git tag mismatch.

## 0.3.1

- Update README, add devtools and reorder sections.

## 0.3.0

- Add devtools plugin.
