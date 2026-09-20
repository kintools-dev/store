# Next.js Todo: Kin Store

Demonstrates Kin Store in a Next.js (App Router) application with SSR:

- `createStore` with **immer** (draft mutations) and **persist**
  (localStorage)
- `createTodoStore` factory: each client render gets its own store instance,
  avoiding shared state across SSR requests
- `StoreProvider`: injects the store into the React component tree via context
- `skipHydration: true`: defers `localStorage` reads until after the client
  mounts (SSR-safe)

## Stack

Node.js · Next.js (App Router) · React · TypeScript · Tailwind CSS

## Running

Requires Node.js v18 or later.

```bash
npm install
npm run dev          # starts on http://localhost:3333
```

## Building

```bash
npm run build
npm run start        # serve the production build
```
