---
description: "Why Kin Store exists: three primitives (createStore, withPlugins, derive), zero dependencies, full type inference, and opt-in complexity you only pay for when you use it."
---

# Why Kin Store?

Kin Store starts from one constraint: the smallest set of ideas a state library
actually needs, and nothing past that.

## What that meant in practice

Three primitives came out of that constraint: `createStore`, `withPlugins`, and
`derive`.

| Primitive                                  | What it does                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| [`createStore`](/store/guide/create-store) | The irreducible floor. `get` · `set` · `subscribe`. Nothing else.                     |
| [`withPlugins`](/store/guide/with-plugins) | Opt-in structure: methods, reducers, middleware, lifecycle hooks, namespaced plugins. |
| [`derive`](/store/guide/derive)            | Lazy, dependency-tracked, read-only views composed from one or more stores.           |

None of them carry a framework's worth of internal bookkeeping. A bare
`createStore` is a value and three methods, nothing else. Whatever structure you
add on top, methods, reducers, middleware, only exists because you `.use()`'d a
plugin for it through `withPlugins`; the store doesn't route everything through
a slice and a dispatch table by default.

Nothing runs through a proxy or a full reactive graph either. A bare store costs
exactly what `get`/`set`/`subscribe` cost, and each plugin you layer on adds its
own cost on top, stacking rather than multiplying against what was already
there.

Type inference comes along on top of that: reducer arguments, dispatch calls,
and plugin methods are fully inferred, so you're not hand-annotating what the
compiler already knows.

Curious how this holds up against Redux, Zustand, Jotai, or MobX in practice?
See the full [comparison](/store/comparison/) — line-by-line, with the tradeoffs
named directly.

## Next

- [Getting Started](/store/guide/getting-started) — install and write your first
  store.
- [Design Principles](/store/guide/design-principles) — the reasoning behind
  each API choice.
