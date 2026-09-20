/**
 * `@kintools/store-react`: React bindings for `@kintools/store-core`, built on
 * `useSyncExternalStore`.
 *
 * - {@linkcode useStore} and {@linkcode useSelector} subscribe a component to
 *   a store (or a transformed value from it); `useSelector` adds an equality
 *   check.
 * - {@linkcode shallowEqual} is the default equality function for
 *   {@linkcode useSelector}, also usable standalone.
 * - {@linkcode StoreProvider} and {@linkcode useStoreContext} inject a store
 *   via React context instead of a module-level singleton.
 *
 * Re-exports all of `@kintools/store-core`, so consumers only need this one
 * package for React apps.
 *
 * @module
 */
export * from "@kintools/store-core";

export * from "./context.tsx";
export * from "./hooks.ts";
