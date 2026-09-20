# Structured Todo: Kin Store

Demonstrates `createStore` with the **immer**, **persist**, and **devtools**
plugins:

- `immer`: write methods with mutable draft syntax, called directly as
  `store.addTodo(...)`
- `persist`: automatically saves state to `localStorage` and restores it on load
- `devtools`: connects to the Redux DevTools extension so every state change
  shows up in its diff view

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
