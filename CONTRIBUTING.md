# Contributing to Kin Store

Thanks for taking the time to contribute. This document covers how to get set up
locally, the conventions the codebase follows, and how to submit changes.

## Getting set up

This is a [Deno](https://deno.com) workspace with three publishable packages
(`core`, `plugins`, `react`), a docs site (`docs/`), and example apps
(`examples/`). Node/npm dependencies are consumed via `npm:` specifiers and
resolved into `node_modules`.

Install the
[Deno CLI](https://docs.deno.com/runtime/getting_started/installation/), then
from the repo root:

```sh
git config core.hooksPath .git-hooks   # enables the pre-commit lint/test hook
deno task test                          # run all tests
deno lint                               # lint the workspace
```

## Making a change

1. Fork the repo and create a branch off `main`.
2. Make your change. Add or update tests alongside the source file you're
   changing (`<name>.test.ts`, co-located, not in a separate `test/` directory).
3. Run `deno lint` and `deno task test` before opening a PR; the pre-commit hook
   runs the same checks and will block a commit that fails them.
4. If you're touching a public export, update its JSDoc: exported symbols are
   documented extensively, since JSDoc feeds the JSR package page directly.
5. Open a pull request describing what changed and why. Link any related issue.

## Code conventions

- Public API is exported only through each package's `index.ts`. Import other
  packages' public APIs through their `@kintools/store-<pkg>` specifier, not by
  reaching into internal files.
- Internal, non-exported helpers live in `_internals.ts` / `_types.ts`.
- Commit subjects follow `type(scope): summary` (e.g. `fix(core): ...`,
  `feat(react): ...`); non-trivial `feat`/`fix` commits carry a descriptive
  body.
- Version bumps and `CHANGELOG.md` entries are their own commits, made only when
  preparing to publish, never mixed into a `feat`/`fix`/`refactor` commit.

See [CLAUDE.md](./CLAUDE.md) for the full architecture and conventions reference
used when working on this codebase.

## Reporting bugs and requesting features

Use the issue templates when opening a
[new issue](https://github.com/kintools-dev/store/issues/new/choose). For
open-ended questions or design discussions, use
[Discussions](https://github.com/kintools-dev/store/discussions) instead.

## Security issues

Please don't open a public issue for a security vulnerability. See
[SECURITY.md](./SECURITY.md) for how to report one privately.
