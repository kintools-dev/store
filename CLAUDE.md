# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this is

Kin Store — a framework-agnostic, zero-dependency TypeScript reactive state
library, published to JSR. It's a Deno workspace with three publishable packages
plus docs and examples.

- `@kintools/store-core` (`core/`): `createStore`, `derive`, the primitives
  everything else is built on.
- `@kintools/store-plugins` (`plugins/`) — official plugins: `persist`,
  `history`, `immer`, `devtools`.
- `@kintools/store-react` (`react/`) — `useStore`, `useSelector`,
  `StoreProvider`/`useStoreContext`.
- `docs/` — documentation content (Markdown + images): guides, plugin docs,
  comparison page. No site tooling lives here; kintools.dev reads this folder at
  build time and renders it.
- `examples/` (standalone Vite/Next.js apps demonstrating usage: `todo-minimal`,
  `todo-structured-style`, `todo-structured-style-nextjs`,
  `checkout-structured-style-react-query`, `checkout-minimal-style-react-query`)
  plus `code-snippets.local/` (untracked scratch snippets used while writing
  docs, not part of any workspace build).

This is a Deno project (`deno.json` at root defines the workspace: `core`,
`plugins`, `react`, `examples/*`, `scripts`). `docs/` is plain content, not a
workspace member (it has no `deno.json` of its own). Node/npm dependencies
(React, immer, etc.) are consumed via `npm:` specifiers and resolved into
`node_modules` (`nodeModulesDir: auto`); a package must be a workspace member
for its `npm:` specifiers to resolve this way, which is why `scripts` is listed
despite keeping its own `deno.json` for task/import isolation.

## Commands

Run from the repo root unless noted.

```sh
# Run all tests (root deno.json task)
deno task test          # = deno test -A

# Run tests for one package
deno test -A core
deno test -A plugins
deno test -A react

# Run a single test file
deno test -A core/create-store.test.ts

# Lint (required before commit — see below)
deno lint

# Bundle-size check for core primitives and the react package
deno task --cwd scripts bundle-size

# Speed benchmark: @kintools/store-react vs Zustand/Redux Toolkit/Jotai/MobX
deno task --cwd scripts speed-bench
```

`docs/` has no dev/build tasks of its own; it's rendered by the kintools.dev
site (a separate repo), which reads this folder at build time.

There is no separate typecheck task — `deno test`/`deno lint` surface type
errors as part of Deno's normal compilation.

### Pre-commit hook

`.git-hooks/pre-commit` runs `deno lint` on every commit, and blocks on failure.
`deno test -A` only runs when the commit's staged files include a `.ts`/`.tsx`
file under `core/`, `plugins/`, or `react/` — commits touching only
docs/examples/config skip the ~20s test run. Configure git to use this hooks dir
if it isn't already (`git config core.hooksPath .git-hooks`).

### Publishing

`.github/workflows/publish.yml` triggers on tags `core@*`, `plugins@*`,
`react@*`. Each publish job runs `deno lint` +
`deno test -A core plugins react`, then `deno publish` from that package's
directory. Package versions live in each package's `deno.json`
(`core/deno.json`, `plugins/deno.json`, `react/deno.json`) and must be bumped
before tagging.

The three publish jobs are independent in CI (no `needs` between them), but when
a change touches multiple packages, tag and push `core` first and confirm its
publish job succeeds (`gh run list --workflow=publish.yml`) before
tagging/pushing `plugins`/`react` — they depend on `core`, so publishing them
first risks pinning against a core version that isn't live on JSR yet.

#### Version bumps and CHANGELOG entries are their own commit

Code commits (`feat`/`fix`/`refactor`/`docs`) never touch a package's
`deno.json` version or `CHANGELOG.md`. Bumping is a separate
`chore: bump version` commit, written only when preparing to publish, that can
batch everything accumulated across multiple prior commits (and multiple
packages) since the last bump.

Each published version is git-tagged (`core@0.2.3`, `plugins@0.3.5`,
`react@0.2.3`, ...), so at bump time the changelog entry is drafted straight
from the commits since the last tag, not tracked incrementally:

```sh
git log core@0.2.3..HEAD --oneline -- core/
```

Commit messages already carry enough detail (a `type(scope): summary` subject
plus a descriptive body on non-trivial `feat`/`fix` commits) to draft the entry
from directly.

## Architecture

### Layering: `createStore` (with `.use()` built in), then `derive`

- **`createStore(initialState)`** (`core/create-store.ts`) is the whole
  primitive: `get()`, `set(next | updater)`, `merge(partial | updater)`,
  `subscribe(listener)`, `destroy()`, and `.use(plugin)` /
  `.use(namespace, plugin)`. There is no separate `withPlugins` step; every
  store gets `.use()` for free. Key mechanics:
  - A **plugin** (`StorePlugin`) is a plain object of methods plus optional
    `onActivated`/`onDestroy` lifecycle hooks. No `reducers`, `middleware`, or
    factory `store` parameter; every method (and `onActivated`/`onDestroy`)
    reaches the store through `this`, real and runtime-bound (via
    `Function.prototype.apply`), not just a type-level convenience. Only
    regular `method() {}` syntax gets this binding; arrow-function-valued
    methods don't rebind `this`.
  - Methods are attached directly to the store (`store.<name>(...)`) or, when
    registered with a namespace, to `store.<namespace>.<name>(...)`.
    Duplicate top-level or namespaced method names throw.
  - There is deliberately no action tracing: no middleware pipeline and no
    ambient `currentAction()`. Both were tried. `currentAction()` had one
    consumer (`devtools`) and leaked in async methods (lost after an `await`),
    nested methods, and listener-triggered writes, so it was removed. `devtools`
    sends every change as `"@@CHANGE"`. If naming is needed again, add an
    explicit optional label to `set`/`merge` passed to listeners (as Zustand's
    devtools does) rather than reviving ambient state.
  - `destroy()` is idempotent, runs plugins' `onDestroy` callbacks in
    registration order, then makes `get`/`set`/`merge`/`subscribe`/`use`/every
    method throw.
  - A parameterized plugin factory (e.g. `persist(options)`) still declares
    its return type as `StorePlugin<TState, TStoreMethods, TNamespace,
    TPluginMethods>` (a union of the plain-object `PluginBody` shape and the
    function-taking `StorePluginFactory` shape) purely so `TState` infers
    correctly at the `.use()` call site, even though every official plugin's
    implementation just returns a plain object. See `core/create-store.ts`'s
    `StorePlugin`/`StorePluginFactory`/`PluginBody` JSDoc for the full
    reasoning if extending this pattern. Note: because `PluginBody`'s
    `ThisType` marker carries no structural members of its own, a plugin with
    *only* `onActivated`/`onDestroy` (both optional) is trivially compatible
    with any `TStoreMethods`, so "require another plugin to be registered
    first" constraints only actually get enforced by TypeScript when the
    plugin also contributes at least one real (non-optional) method.

- **`derive(compute)`** (`core/derive.ts`) creates a read-only store computed
  from other stores. Dependencies are auto-tracked per-recompute via the
  `get(sourceStore)` helper passed into `compute`; the derived store is "cold"
  (unsubscribes from all sources, drops cached state) whenever it has zero
  subscribers, and re-establishes dependencies lazily on the next `get()`/first
  subscriber. Use `prev()` inside `compute` to access the derived store's own
  previous value (accumulators); this requires an explicit type parameter
  (`derive<T>(...)`) since TS can't infer it from `prev()`'s usage.

### Plugins package conventions

Official plugins (`plugins/*.ts`) are built entirely on the public
`@kintools/store-core` API, they don't reach into core internals. Each plugin
exports its options type and a factory function (e.g. `persist(options)`)
returning a `StorePlugin`, whose methods reach the store via `this`.
`immer.ts` is the only plugin with an npm dependency (`immer`, declared in
`plugins/deno.json` imports); it wraps a plugin's own methods individually
(`fn.apply(asImmerStore(this), args)`) so `this.set` accepts an Immer recipe
instead of a full state replacement, since plugin methods have no `store`
reference of their own to substitute in one place.

### React bindings

Thin wrappers around `useSyncExternalStore` (`react/hooks.ts`) — no separate
reactivity system. `useStore` re-subscribes via `store.subscribe`/`store.get`;
`useSelector` adds a custom equality check (defaulting to `shallowEqual`) to
avoid re-renders when a selector returns new references.
`StoreProvider`/`useStoreContext` (`react/context.tsx`) are a plain React
context for DI, named `useStoreContext` rather than `useStore` to make clear it
doesn't itself subscribe to state the way `useStore` does.

## Code conventions

- Tests are co-located as `<name>.test.ts` next to the source file (Deno
  convention), not in a separate `__tests__` or `test/` directory.
- Internal/non-exported helpers live in `_internals.ts` / `_types.ts`
  (underscore prefix signals "not part of the public API").
- Public API surface is exported only via each package's `index.ts`, mapped to
  the bare `@kintools/store-<pkg>` specifier by that package's `deno.json`
  `exports` map (a `./index.ts` deep path also still resolves, for back-compat).
  Import other packages' public APIs through that specifier (e.g.
  `@kintools/store-core`), not by reaching into internal files.
- JSDoc on exported symbols is extensive and treated as user-facing
  documentation (it feeds the JSR package page) — `@example`, `@template`, and
  `@linkcode` tags are used consistently. Match this style when adding/editing
  public API.
- A JSDoc block's `@template`/other tags must be attached to the same comment
  block as the summary — a second, separate `/** ... */` block directly above
  the symbol is legal TS but `deno doc` doesn't associate it with the symbol,
  silently dropping those tags from the JSR page.
- Plugin factories (`history`, `devtools`, `persist`, and similar functions that
  return a `StorePlugin`) should have summaries starting with an action verb
  describing what calling them produces (e.g. "Creates a plugin that ..."), not
  a noun phrase describing the plugin itself (e.g. "Plugin that ...") — the
  exported symbol is the factory, not the plugin instance.
- Overloaded exported functions get a full, independent JSDoc block per overload
  (summary, `@template`/`@param`/`@example` as applicable) — don't have one
  overload's doc point back to another's with "see above", since JSR/IDE hover
  for that overload would otherwise show only the pointer.
- In TS/TSX documentation code blocks (in JSDoc and in `docs/`), use semicolons
  on statements and periods on sentence-style comments; shell code blocks are
  exempt from this.
