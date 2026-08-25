---
description: "Frequently asked questions and honest non-goals: what Kin Store deliberately doesn't do, framework support, SSR, DevTools, and where server state belongs."
---

# FAQ & Non-Goals

## Frequently asked questions

### Is Kin Store production-ready?

The core API (`createStore`, `withPlugins`, `derive`), the official plugins, and
the React bindings are all covered by tests that run on every publish. That
said, the project is young: small community, short track record. Weigh those as
real inputs to your own risk assessment, not something the docs will talk you
out of.

### Does it work outside React?

`@kintools/store-core` and `@kintools/store-plugins` have zero framework
dependency: a store is a plain value with `get`/`set`/`subscribe`, usable from
any JS/TS environment (vanilla, a framework's own reactivity, a worker, a
Node/Deno backend). `@kintools/store-react` is the only official framework
binding published today.

### Is there official Vue, Svelte, or Solid support?

Not today. Nothing in the architecture is React-specific (`useStore` is a thin
`useSyncExternalStore` wrapper), so a similar binding for another framework is
plausible future work, but no such package exists or is published yet.
`subscribe` is plain enough to wire into another framework's reactivity by hand
in the meantime.

### Does it work with SSR / Next.js?

See the [Next.js example](/store/examples/nextjs). SSR mainly changes two
things: where the store instance lives (constructed per-request or via a
provider, not a module-level singleton shared across requests) and when
`persist` is allowed to touch `localStorage` (skipped on the server, hydrated
explicitly on the client).

### Is there a DevTools integration?

The official [`devtools`](/store/plugins/devtools) plugin connects a store to
the Redux DevTools Extension for time-travel debugging, action replay, and
jump-to-state. It's opt-in like every other plugin; a store that never registers
it carries no devtools code.

### Can reducers or methods be async?

`methods` can be async directly; a method is just a function with full access to
`get`/`set`/`dispatch`. `reducers` are pure and synchronous by design,
`(state, ...args) => nextState`, so async work (a `fetch` call) belongs in a
method that calls `dispatch` or `set` once the result is ready, not in the
reducer itself.

### How does Kin Store handle server state, caching, and refetching?

It doesn't, on purpose. `createStore`/`withPlugins` model state your client
owns; server-owned data (cached responses, request dedup, background refetch) is
TanStack Query's job, not Kin Store's. See the
[TanStack Query examples](/store/examples/) for two ways to split the two:
client state as one `withPlugins` store, or one `createStore` per field.

### Does `persist` or `broadcast` handle conflict resolution for concurrent edits?

No. `persist` writes state to storage and reads it back; `broadcast` mirrors
state across tabs with last-write-wins by wall-clock time, so if two tabs change
state within the same millisecond, one change is silently dropped. Neither
merges concurrent edits. For state that genuinely needs that (real-time
collaborative editing), reach for a CRDT library instead.

### What's the bundle size?

`createStore` is 231 B gzipped, `withPlugins` is 1.0 KB, and `derive` is 438 B,
each measured independently since you only pay for what you `.use()`. Plugins
and the React bindings add their own (small) cost on top only when imported.

### Where do I ask a question or report a bug?

[GitHub Discussions](https://github.com/kintools-dev/store/discussions) for
questions and design feedback,
[Issues](https://github.com/kintools-dev/store/issues) for bugs.

## Non-goals

Kin Store has no request cache, no dedup, no background refetch; server state
(cached responses, in-flight data) is TanStack Query's job, and
`createStore`/`withPlugins` only ever model what the client owns.

State changes only through `set` or a dispatched reducer. Nothing mutates a
draft behind your back unless you explicitly opt into the
[`immer`](/store/plugins/immer) plugin, so there's no implicit, proxy-based
reactivity happening anywhere by default.

It's also not a schema-validation library: state shape is whatever TypeScript
type you give `createStore`, and validating external input (an API response, a
form submission) is left to a dedicated library. And it's not multi-framework
yet; `@kintools/store-react` is the only official binding, with no Vue, Svelte,
or Solid package. If you're interested in Kin Store and want bindings for other
frameworks, please
[file an issue](https://github.com/kintools-dev/store/issues).

Neither `persist` nor `broadcast` does conflict resolution beyond
last-write-wins, so don't reach for either as a substitute for a CRDT on state
that genuinely needs merged concurrent edits.

Finally, Kin Store isn't trying to out-feature Redux. There's no built-in
serializable action log format, no time-travel outside the `devtools` plugin,
and no code-generation step. The [comparison page](/store/comparison/) covers
those tradeoffs directly.
