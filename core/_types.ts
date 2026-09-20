// deno-lint-ignore-file no-explicit-any
type Method = (...args: any[]) => any;

/**
 * A flat map of method name → arbitrary function attached to a store.
 */
export type Methods = Record<string, Method>;

/**
 * Either a flat {@linkcode Methods} map **or** a one-level nested map where
 * each value is itself a `Methods` map (a namespace).
 *
 * Top-level methods are accessible at `store.<name>`. Namespaced methods are
 * accessible at `store.<namespace>.<name>`.
 */
export type NestedMethods = Methods | Record<string, Methods>;
