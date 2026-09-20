/**
 * `@kintools/store-core`: the framework-agnostic primitives every other Kin
 * Store package builds on.
 *
 * - {@linkcode createStore} creates a reactive store: `get`/`set`/`merge`/
 *   `subscribe`, plus `.use()` to add methods, lifecycle hooks, and
 *   namespacing via plugins.
 * - {@linkcode derive} creates a read-only store computed from other stores,
 *   with automatic dependency tracking.
 * - {@linkcode listenerWithSelector} narrows a listener down to a selected
 *   part of the state, using {@linkcode shallowEqual} by default.
 *
 * @module
 */
export * from "./create-store.ts";
export * from "./derive.ts";
export * from "./utils.ts";
