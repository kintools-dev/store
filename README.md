# Kin Store

[![JSR @kintools/store-core](https://jsr.io/badges/@kintools/store-core)](https://jsr.io/@kintools/store-core)
![License: MIT](https://img.shields.io/badge/License-MIT-166534?style=flat)
![Framework-agnostic](https://img.shields.io/badge/Framework--agnostic-166534?style=flat)
![Tiny footprint](https://img.shields.io/badge/Tiny%20footprint-166534?style=flat)
![100% type-safe](https://img.shields.io/badge/100%25%20type--safe-166534?style=flat)
![Zero dependencies](https://img.shields.io/badge/Zero%20dependencies-166534?style=flat)

Start with a plain store. Add structure only when the app earns it.

Most state libraries pick your architecture before you know if the app needs
one: actions, reducers, selectors, a provider tree, decided on day one. Kin
Store leaves that decision to you: `set` and `dispatch` are equally first-class,
not a beginner tier and an advanced one.

## Docs

[→ Documentation website](https://kinstore.dev)

## Feature matrix

|                           | **Kin Store** | Zustand | Redux / RTK | Jotai  |  MobX   |
| ------------------------- | :-----------: | :-----: | :---------: | :----: | :-----: |
| Bundle size (React usage) |    2.0 KB     |  389 B  |   17.5 KB   | 4.0 KB | 15.6 KB |
| Zero dependencies         |      ✅       |   ✅    |     ❌      |   ✅   |   ✅    |
| Tiny footprint            |      ✅       |   ✅    |     ❌      |   ✅   |   ❌    |
| 100% type-safe            |      ✅       |   ⚠️    |     ⚠️      |   ✅   |   ✅    |
| Low boilerplate           |      ✅       |   ⚠️    |     ❌      |   ⚠️   |   ⚠️    |
| Linear plugin composition |      ✅       |   ❌    |     ❌      |   —    |    —    |
| Separate state and logic  |      ✅       |   ❌    |     ✅      |   —    |   ✅    |
| Opt-in complexity         |      ✅       |   ✅    |     ❌      |   ⚠️   |   ❌    |
| No hidden magic           |      ✅       |   ✅    |     ✅      |   ✅   |   ❌    |
| Reactive composition      |      ✅       |   ⚠️    |     ❌      |   ✅   |   ✅    |

✅ full support · ⚠️ partial or conditional · — not applicable (different model)

Bundle sizes are each library's full package import, bundled with rolldown,
minified, and gzipped; tree-shaking down to only the APIs you use will land
smaller across the board.

Don't believe it?
[See full comparison with code examples →](https://kinstore.dev/comparison)

Kin Store is pay-per-use: import only `createStore` and pay 231 B. Import
`withPlugins` and pay 1.0 KB. The plugin bundles (`persist`, `history`, `immer`)
add only what you import.

## Packages

| Package                                          | Description                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [`@kintools/store-core`](./core/README.md)       | `createStore`, `withPlugins`, `derive` — the core primitives |
| [`@kintools/store-plugins`](./plugins/README.md) | `persist`, `history`, `immer` — official plugins             |
| [`@kintools/store-react`](./react/README.md)     | `useStore`, `useSelector` — React bindings                   |
