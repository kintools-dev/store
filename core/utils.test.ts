import { assertEquals } from "@std/assert";
import { createStore } from "./create-store.ts";
import { derive } from "./derive.ts";
import { listenerWithSelector, shallowEqual } from "./utils.ts";

Deno.test("listenerWithSelector - fires when selected value changes", () => {
  const store = createStore({ count: 0, name: "Alice" });
  const calls: [number, number][] = [];

  const listener = listenerWithSelector(
    function (prevSelected, nextSelected) {
      calls.push([prevSelected, nextSelected]);
    },
    (s: { count: number; name: string }) => s.count,
  );

  store.subscribe(listener);
  store.set({ count: 1, name: "Alice" });
  store.set({ count: 2, name: "Alice" });
  assertEquals(calls, [[0, 1], [1, 2]]);
});

Deno.test(
  "listenerWithSelector - does not fire when unselected field changes",
  () => {
    const store = createStore({ count: 0, name: "Alice" });
    let calls = 0;

    const listener = listenerWithSelector(
      () => calls++,
      (s: { count: number; name: string }) => s.count,
    );

    store.subscribe(listener);
    store.set({ count: 0, name: "Bob" });
    assertEquals(calls, 0);
  },
);

Deno.test("listenerWithSelector - this.get() returns the full state", () => {
  const store = createStore({ count: 5, name: "Alice" });
  let stateFromCallback: { count: number; name: string } | undefined;

  const listener = listenerWithSelector(
    function () {
      stateFromCallback = this.get();
    },
    (s: { count: number; name: string }) => s.count,
  );

  store.subscribe(listener);
  store.set({ count: 10, name: "Alice" });
  assertEquals(stateFromCallback, { count: 10, name: "Alice" });
});

Deno.test("listenerWithSelector - this is the store, so it can call set", () => {
  const store = createStore({ count: 0, doubled: 0 });

  store.subscribe(listenerWithSelector(
    function (_prevCount, nextCount) {
      this.merge({ doubled: nextCount * 2 });
    },
    (s: { count: number; doubled: number }) => s.count,
  ));

  store.merge({ count: 3 });
  assertEquals(store.get(), { count: 3, doubled: 6 });
});

Deno.test("listenerWithSelector - defaults to shallowEqual", () => {
  const store = createStore({ items: [1, 2, 3], name: "Alice" });
  let calls = 0;

  const listener = listenerWithSelector(
    () => calls++,
    (s: { items: number[]; name: string }) => ({ items: s.items }),
  );

  store.subscribe(listener);
  // New selected object, but same `items` reference: should NOT fire
  store.set({ items: store.get().items, name: "Bob" });
  assertEquals(calls, 0);

  // Different `items` reference: should fire
  store.set({ items: [1, 2, 3], name: "Bob" });
  assertEquals(calls, 1);
});

Deno.test("listenerWithSelector - custom equality function", () => {
  const store = createStore({ items: [1, 2, 3] });
  let calls = 0;

  const listener = listenerWithSelector(
    () => calls++,
    (s: { items: number[] }) => s.items,
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  store.subscribe(listener);
  // Same content, different reference: should NOT fire
  store.set({ items: [1, 2, 3] });
  assertEquals(calls, 0);

  // Different content: should fire
  store.set({ items: [1, 2] });
  assertEquals(calls, 1);
});

Deno.test(
  "listenerWithSelector - initializes prevSelected from prevState on first call",
  () => {
    const store = createStore({ count: 42 });
    let prevReceived: number | undefined;

    const listener = listenerWithSelector(
      function (prev) {
        prevReceived = prev;
      },
      (s: { count: number }) => s.count,
    );

    store.subscribe(listener);
    store.set({ count: 99 });
    assertEquals(prevReceived, 42);
  },
);

Deno.test("listenerWithSelector - this has no set on a derived store", () => {
  const source = createStore({ count: 0 });
  const derived = derive((get) => get(source).count);

  derived.subscribe(listenerWithSelector(
    function () {
      // @ts-expect-error A derived store is read-only.
      this.set(0);
    },
    (n: number) => n,
  ));
});

Deno.test("shallowEqual - same reference is equal", () => {
  const obj = { a: 1 };
  assertEquals(shallowEqual(obj, obj), true);
});

Deno.test("shallowEqual - equal primitives", () => {
  assertEquals(shallowEqual(1, 1), true);
  assertEquals(shallowEqual("a", "a"), true);
  assertEquals(shallowEqual(undefined, undefined), true);
  assertEquals(shallowEqual(1, 2), false);
});

Deno.test("shallowEqual - one side primitive, other object", () => {
  assertEquals(shallowEqual(null, {}), false);
  assertEquals(shallowEqual({}, null), false);
  assertEquals(shallowEqual(1, { a: 1 }), false);
});

Deno.test("shallowEqual - objects with same keys/values", () => {
  assertEquals(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
});

Deno.test("shallowEqual - objects with different values", () => {
  assertEquals(shallowEqual({ a: 1 }, { a: 2 }), false);
});

Deno.test("shallowEqual - objects with different key counts", () => {
  assertEquals(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
});

Deno.test("shallowEqual - objects with different keys, same count", () => {
  assertEquals(shallowEqual({ a: 1 }, { b: 1 }), false);
});

Deno.test("shallowEqual - nested objects differ by reference", () => {
  assertEquals(shallowEqual({ a: { b: 1 } }, { a: { b: 1 } }), false);
});

Deno.test("shallowEqual - equal arrays", () => {
  assertEquals(shallowEqual([1, 2, 3], [1, 2, 3]), true);
});

Deno.test("shallowEqual - arrays with different lengths", () => {
  assertEquals(shallowEqual([1, 2, 3], [1, 2, 3, 4]), false);
});

Deno.test("shallowEqual - arrays with different order", () => {
  assertEquals(shallowEqual([1, 2, 3], [3, 2, 1]), false);
});
