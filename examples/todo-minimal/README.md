# Minimal Todo: Kin Store

Demonstrates the minimal `createStore` API. Actions are plain functions that
call `store.merge`; no plugins required.

## Stack

[Deno](https://deno.com) · Vite · React · TypeScript · Tailwind CSS

## Running

Requires Deno v2 or later.

```bash
deno task dev
```

## Building

```bash
deno task build      # production bundle → dist/
deno task preview    # preview the production build locally
deno task serve      # serve dist/ with a static file server
```
