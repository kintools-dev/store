/// <reference lib="dom" />
import { Window } from "happy-dom";
import { act, renderHook } from "@testing-library/react";
import { assertEquals, assertThrows } from "@std/assert";

import { createStore, derive } from "@kintools/store-core";
import { useSelector, useStore } from "./hooks.ts";
import { StoreProvider, useStoreContext } from "./context.tsx";

// ---------------------------------------------------------------------------
// DOM setup: required for React rendering
// ---------------------------------------------------------------------------

const window = new Window({ url: "http://localhost/" });
// deno-lint-ignore no-explicit-any
(globalThis as any).document = window.document;
// deno-lint-ignore no-explicit-any
(globalThis as any).window = window;
// deno-lint-ignore no-explicit-any
(globalThis as any).navigator = window.navigator;

// ---------------------------------------------------------------------------
// useStore
// ---------------------------------------------------------------------------

Deno.test("useStore - returns initial state", () => {
  const store = createStore({ count: 0 });
  const { result } = renderHook(() => useStore(store));
  assertEquals(result.current, { count: 0 });
});

Deno.test("useStore - re-renders when state changes", () => {
  const store = createStore({ count: 0 });
  const { result } = renderHook(() => useStore(store));

  act(() => store.set({ count: 5 }));
  assertEquals(result.current, { count: 5 });
});

Deno.test("useStore - works with a derived store", () => {
  const count = createStore(2);
  const doubled = derive((get) => get(count) * 2);

  const { result } = renderHook(() => useStore(doubled));
  assertEquals(result.current, 4);

  act(() => count.set(5));
  assertEquals(result.current, 10);
});

// ---------------------------------------------------------------------------
// useSelector
// ---------------------------------------------------------------------------

Deno.test("useSelector - returns selected slice", () => {
  const store = createStore({ count: 0, name: "Alice" });
  const { result } = renderHook(() => useSelector(store, (s) => s.name));
  assertEquals(result.current, "Alice");
});

Deno.test(
  "useSelector - does not re-render when unselected field changes",
  () => {
    const store = createStore({ count: 0, name: "Alice" });
    let renders = 0;

    const { result } = renderHook(() => {
      renders++;
      return useSelector(store, (s) => s.count);
    });

    const initialRenders = renders;
    act(() => store.set({ count: 0, name: "Bob" })); // count unchanged
    assertEquals(result.current, 0);
    assertEquals(renders, initialRenders); // no extra render
  },
);

Deno.test("useSelector - re-renders when selected field changes", () => {
  const store = createStore({ count: 0, name: "Alice" });
  const { result } = renderHook(() => useSelector(store, (s) => s.count));

  act(() => store.set({ count: 99, name: "Alice" }));
  assertEquals(result.current, 99);
});

Deno.test(
  "useSelector - defaults to shallowEqual for new-reference selectors",
  () => {
    const store = createStore({ items: [1, 2, 3] });
    let renders = 0;

    const { result } = renderHook(() => {
      renders++;
      return useSelector(store, (s) => s.items.map((x) => x));
    });

    const initialRenders = renders;
    act(() => store.set({ items: [1, 2, 3] })); // same content, new array
    assertEquals(result.current, [1, 2, 3]);
    assertEquals(renders, initialRenders);
  },
);

Deno.test(
  "useSelector - suppresses re-render with custom equality",
  () => {
    const store = createStore({ items: [1, 2, 3] });
    let renders = 0;

    const { result } = renderHook(() => {
      renders++;
      return useSelector(
        store,
        (s) => s.items,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
    });

    const initialRenders = renders;
    act(() => store.set({ items: [1, 2, 3] })); // same content
    assertEquals(result.current, [1, 2, 3]);
    assertEquals(renders, initialRenders);
  },
);

Deno.test("useSelector - re-renders when content differs", () => {
  const store = createStore({ items: [1, 2, 3] });
  const { result } = renderHook(() =>
    useSelector(
      store,
      (s) => s.items,
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    )
  );

  act(() => store.set({ items: [1, 2] }));
  assertEquals(result.current, [1, 2]);
});

Deno.test(
  "useSelector - equalFn is never called with an undefined prev",
  () => {
    const store = createStore({ items: [1, 2, 3] });

    // `a.length` throws if `a` were ever undefined; a clean run proves the
    // hook only calls equalFn once a previous slice exists.
    const { result } = renderHook(() =>
      useSelector(
        store,
        (s) => s.items,
        (a, b) => a.length === b.length,
      )
    );
    assertEquals(result.current, [1, 2, 3]);

    act(() => store.set({ items: [4, 5] })); // different length
    assertEquals(result.current, [4, 5]);
  },
);

Deno.test(
  "useSelector - returns stable reference when equal",
  () => {
    const store = createStore({ items: [1, 2, 3] });

    const { result } = renderHook(() => {
      const r = useSelector(
        store,
        (s) => s.items,
        (a, b) => JSON.stringify(a) === JSON.stringify(b),
      );
      return r;
    });

    const ref1 = result.current;
    act(() => store.set({ items: [1, 2, 3] }));
    const ref2 = result.current;

    assertEquals(ref1 === ref2, true); // same reference
  },
);

// ---------------------------------------------------------------------------
// StoreProvider / useStoreContext
// ---------------------------------------------------------------------------

Deno.test("useStoreContext - returns the provided store", () => {
  const store = createStore({ count: 0 });

  const { result } = renderHook(() => useStoreContext(), {
    wrapper: ({ children }) => (
      <StoreProvider store={store}>{children}</StoreProvider>
    ),
  });

  assertEquals(result.current, store);
});

Deno.test("useStoreContext - throws outside StoreProvider", () => {
  // renderHook wraps in React, so we expect the thrown error to propagate
  assertThrows(
    () => renderHook(() => useStoreContext()),
    Error,
    "StoreProvider",
  );
});
