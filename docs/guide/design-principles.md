---
description: "The four principles behind every Kin Store API decision: explicit over implicit, opt-in complexity, type safety by default, two mutation tiers."
---

# Design Principles

These four principles shaped every API decision in Kin Store. Understanding them
makes the library predictable, and explains why things work the way they do.

## Explicit over implicit

No hidden merges, no auto-propagating destroy, no magic dependency graphs. If
something happens, you triggered it.

`set` replaces the entire state — there is no shallow merge happening behind the
scenes. `derive` tracks only the stores you explicitly read with `get(store)`.
`destroy` must be called manually — nothing propagates to child stores
automatically. The `CANCELED` sentinel, named reducers, and the two-tier
mutation model all follow from this principle.

## Opt-in complexity

`createStore` is the floor. `withPlugins` adds methods, reducers, middleware,
and lifecycle hooks, only when you import it. `derive` adds reactive
composition, only when you reach for it. You never pay for capability you
haven't opted into.

## Type safety by default

Every reducer argument, dispatch call, and plugin method is fully inferred, no
`any` or `unknown`, no manual annotation at call sites. The type system is
load-bearing, not decorative.

`dispatch.addTodo("Buy groceries")` knows that `addTodo` takes a `string`. A
middleware that reads `ctx.reducer.args` gets the correct tuple type. A plugin
that adds methods sees the accumulated store type including every plugin
registered before it. Type errors are caught statically, at definition time or
at the call site.

## Two tiers of mutation

`dispatch.*` and `set` are both first-class ways to change state, neither is a
fallback for the other. `dispatch.*` calls a named reducer through the
middleware pipeline, so the change is traceable, loggable, and cancellable.
`set` writes state directly, with no pipeline in between. Which one a team
reaches for is an architectural choice, not a hierarchy, and Kin Store is
deliberately built so any point on that spectrum is a first-class way to use the
library:

- **Primitive composition** — `createStore` + `derive` + plain functions, no
  `withPlugins` at all.
- **Methods only** — `withPlugins` + `methods` that call `set` directly, no
  reducers or middleware.
- **Reducers + middleware** — `withPlugins` + `reducers` dispatched through
  `dispatch.*`, with middleware doing the logging/undo/guard work.
- **Fat store** — `createStore` plus colocated top-level logic functions that
  call `set`, no plugin system involved.

Within a `withPlugins` store, a method can also mix both in the same call:
`dispatch.*` for the parts of a change that should be traceable, `set` for a
direct write, matching what that specific change needs rather than a store-wide
rule. If your team standardizes on one style — e.g. "every mutation goes through
`dispatch.*`" — that's a convention to hold at the module boundary (export
`dispatch` and your methods, not `set`, from your store module), not something
Kin Store enforces for you.
