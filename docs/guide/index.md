---
description: "Why Kin Store exists and the principles behind its API: two primitives, opt-in complexity, explicit state changes, full type inference."
---

# Why Kin Store?

Kin Store starts from one constraint: the smallest set of ideas a state library
actually needs, and nothing past that.

## What that meant in practice

Two primitives came out of that constraint: `createStore` and `derive`.

| Primitive                                  | What it does                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [`createStore`](/store/guide/create-store) | `get` · `set` · `merge` · `subscribe`, plus `.use()` to add methods, namespacing, and lifecycle hooks. |
| [`derive`](/store/guide/derive)            | Lazy, dependency-tracked, read-only views composed from one or more stores.                            |

Neither carries a framework's worth of internal bookkeeping, and nothing runs
through a proxy or a full reactive graph either.

## Explicit over implicit

No hidden merges beyond what `merge` itself does, no auto-propagating destroy,
no magic dependency graphs. If something happens, you triggered it.

- `set` replaces the entire state
- `merge(partial)` behaves like `set((s) => ({ ...s, ...partial }))` or
  `set((s) => ({ ...s, ...partial(s) }))`
- `destroy` must be called manually, nothing propagates to dependent stores
  automatically
- `derive` tracks only the stores you explicitly read with `get(store)`

## Type safety by default

Every method argument is fully inferred, no `any` or `unknown`, no manual
annotation at call sites. The type system is load-bearing, not decorative.

`store.addTodo("Buy groceries")` knows that `addTodo` takes a `string`. A plugin
that adds methods sees the accumulated store type including every plugin
registered before it. Type errors are caught statically, at definition time or
at the call site.

## Next

- [Getting Started](/store/guide/getting-started): install and write your first
  store.
- [FAQ & Non-Goals](/store/guide/faq): what Kin Store deliberately doesn't do.
- [Comparison](/store/comparison): line-by-line against Zustand, Redux, Jotai,
  and MobX.
