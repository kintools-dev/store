import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { createStore } from "./create-store.ts";

// ---------------------------------------------------------------------------
// get / set / subscribe / merge
// ---------------------------------------------------------------------------

Deno.test("get returns initial state", () => {
  const store = createStore(42);
  assertEquals(store.get(), 42);
});

Deno.test("set with a value", () => {
  const store = createStore(0);
  store.set(5);
  assertEquals(store.get(), 5);
});

Deno.test("set with a callback", () => {
  const store = createStore(1);
  store.set((n) => n + 1);
  assertEquals(store.get(), 2);
});

Deno.test("subscribe - listener called on state change", () => {
  const store = createStore(0);
  let calls = 0;
  store.subscribe(() => calls++);
  store.set(1);
  assertEquals(calls, 1);
});

Deno.test("subscribe - listener receives prevState, current state via store.get()", () => {
  const store = createStore(10);
  let received: { prev: number; next: number } | undefined;
  store.subscribe((prevState) => {
    received = { prev: prevState, next: store.get() };
  });
  store.set(20);
  assertEquals(received, { prev: 10, next: 20 });
});

Deno.test("subscribe - no notification when value is unchanged", () => {
  const store = createStore(5);
  let calls = 0;
  store.subscribe(() => calls++);
  store.set(5);
  assertEquals(calls, 0);
});

Deno.test("subscribe - unsubscribe stops notifications", () => {
  const store = createStore(0);
  let calls = 0;
  const unsub = store.subscribe(() => calls++);
  unsub();
  store.set(1);
  assertEquals(calls, 0);
});

Deno.test("subscribe - multiple listeners all notified", () => {
  const store = createStore(0);
  let a = 0,
    b = 0;
  store.subscribe(() => a++);
  store.subscribe(() => b++);
  store.set(1);
  assertEquals(a, 1);
  assertEquals(b, 1);
});

Deno.test("subscribe - listener removed during notification doesn't affect others", () => {
  const store = createStore(0);
  let aCalls = 0;
  let bCalls = 0;

  let unsub: VoidFunction = () => {};
  unsub = store.subscribe(() => {
    aCalls++;
    unsub();
  });
  store.subscribe(() => bCalls++);

  store.set(1);
  assertEquals(aCalls, 1);
  assertEquals(bCalls, 1);

  store.set(2);
  assertEquals(aCalls, 1);
  assertEquals(bCalls, 2);
});

Deno.test("subscribe - unsubscribing right after a listener's own nested set() doesn't corrupt the outer loop", () => {
  const store = createStore(0);
  const calls: string[] = [];
  let unsubB: VoidFunction = () => {};

  store.subscribe((prevState) => {
    calls.push(`a:${prevState}`);
    if (prevState === 0) {
      // Fully completes its own notify pass (calling both listeners again)
      // before returning here.
      store.set(2);
      unsubB();
    }
  });
  unsubB = store.subscribe((prevState) => {
    calls.push(`b:${prevState}`);
  });

  store.set(1);
  // The outer loop, having started before unsubB() ran, still reaches b
  // with the outer notify's own prevState (0). It isn't skipped just
  // because b was removed mid-loop.
  assertEquals(calls, ["a:0", "a:1", "b:1", "b:0"]);

  calls.length = 0;
  store.set(3); // state was left at 2 by the nested set() above
  assertEquals(calls, ["a:2"]); // b really is gone from now on
});

Deno.test("set - object state with same reference is skipped", () => {
  const state = { x: 1 };
  const store = createStore(state);
  let calls = 0;
  store.subscribe(() => calls++);
  store.set(state);
  assertEquals(calls, 0);
});

Deno.test("merge - merges a partial object into state", () => {
  const store = createStore({ count: 0, name: "a" });
  store.merge({ count: 1 });
  assertEquals(store.get(), { count: 1, name: "a" });
});

Deno.test("merge - merges the result of a callback", () => {
  const store = createStore({ count: 1, name: "a" });
  store.merge((s) => ({ count: s.count + 1 }));
  assertEquals(store.get(), { count: 2, name: "a" });
});

Deno.test("merge - notifies listeners", () => {
  const store = createStore({ count: 0 });
  let calls = 0;
  store.subscribe(() => calls++);
  store.merge({ count: 1 });
  assertEquals(calls, 1);
});

Deno.test("subscribe - a regular function listener reads the store via this", () => {
  const store = createStore({ count: 0 }).use({
    increment(n: number): void {
      this.set((s) => ({ count: s.count + n }));
    },
  });
  let seen: number | undefined;
  store.subscribe(function () {
    seen = this.get().count;
  });
  store.increment(5);
  assertEquals(seen, 5);
});

Deno.test("subscribe - a listener can call this.merge() synchronously", () => {
  const store = createStore({ count: 0, doubled: 0 });
  const seen: string[] = [];

  store.subscribe(function () {
    const { count, doubled } = this.get();
    // Guarded so the nested update doesn't retrigger itself forever.
    if (doubled !== count * 2) this.merge({ doubled: count * 2 });
  });
  store.subscribe((prevState) => {
    seen.push(`${prevState.count}/${prevState.doubled}`);
  });

  store.merge({ count: 1 });
  assertEquals(store.get(), { count: 1, doubled: 2 });
  // The nested merge finishes its own notify pass first (prevState 1/0), then
  // the outer pass reaches the second listener with its own prevState (0/0).
  assertEquals(seen, ["1/0", "0/0"]);
});

Deno.test("subscribe - a listener can call this.set() synchronously", () => {
  const store = createStore(0);
  const seen: number[] = [];

  store.subscribe(function () {
    // Clamps the state, so an out-of-range value is corrected in place.
    if (this.get() > 10) this.set(10);
  });
  store.subscribe((prevState) => {
    seen.push(prevState);
  });

  store.set(50);
  assertEquals(store.get(), 10);
  assertEquals(seen, [50, 0]);

  store.set(3);
  assertEquals(store.get(), 3);
  assertEquals(seen, [50, 0, 10]);
});

// ---------------------------------------------------------------------------
// use() - methods
// ---------------------------------------------------------------------------

Deno.test("use - methods are added to the store", () => {
  const store = createStore({ count: 5 }).use({
    doubled(): number {
      return this.get().count * 2;
    },
  });
  assertEquals(store.doubled(), 10);
});

Deno.test("use - namespaced methods", () => {
  const store = createStore({ count: 5 }).use("counter", {
    doubled(): number {
      return this.get().count * 2;
    },
  });
  assertEquals(store.counter.doubled(), 10);
});

Deno.test("use - duplicate method name throws", () => {
  const store = createStore({}).use({ foo: () => 1 });
  assertThrows(
    () => store.use({ foo: () => 2 }),
    Error,
    "already exists",
  );
});

Deno.test("use - duplicate namespace throws", () => {
  const store = createStore({})
    .use("list", { add: () => {} });
  assertThrows(
    () => store.use("list", { clear: () => {} }),
    Error,
    "already been registered",
  );
});

Deno.test("use - multiple use() calls accumulate", () => {
  const store = createStore({})
    .use({ a: () => "a" })
    .use({ b: () => "b" });
  assertEquals(store.a(), "a");
  assertEquals(store.b(), "b");
});

Deno.test("use - onActivated is called after registration", () => {
  let calledWith: number | undefined;
  createStore({ count: 7 }).use({
    onActivated() {
      calledWith = this.get().count;
    },
  });
  assertEquals(calledWith, 7);
});

Deno.test("use - onDestroy is called on destroy", () => {
  let destroyed = false;
  const store = createStore({}).use({
    onDestroy() {
      destroyed = true;
    },
  });
  store.destroy();
  assertEquals(destroyed, true);
});

// ---------------------------------------------------------------------------
// this-binding: sibling methods, earlier plugins, onActivated
// ---------------------------------------------------------------------------

Deno.test("use - a method can call a sibling method via this", () => {
  const store = createStore({ count: 0 }).use({
    increment(): void {
      this.set((s) => ({ count: s.count + 1 }));
    },
    incrementTwice(): void {
      this.increment();
      this.increment();
    },
  });
  store.incrementTwice();
  assertEquals(store.get().count, 2);
});

Deno.test("use - a later plugin's method can call an earlier plugin's method via this", () => {
  const store = createStore({ count: 0 })
    .use({
      increment(): void {
        this.set((s) => ({ count: s.count + 1 }));
      },
    })
    .use({
      incrementTwice(): void {
        this.increment();
        this.increment();
      },
    });
  store.incrementTwice();
  assertEquals(store.get().count, 2);
});

Deno.test("use - a later plugin's method can call an earlier namespaced plugin's method via this", () => {
  const store = createStore({ count: 0 })
    .use("counter", {
      increment(): void {
        this.set((s) => ({ count: s.count + 1 }));
      },
    })
    .use({
      incrementTwice(): void {
        this.counter.increment();
        this.counter.increment();
      },
    });
  store.incrementTwice();
  assertEquals(store.get().count, 2);
});

Deno.test("use - onActivated can call this.method()", () => {
  const store = createStore({ count: 0 }).use({
    onActivated() {
      this.increment();
    },
    increment(): void {
      this.set((s) => ({ count: s.count + 1 }));
    },
  });
  assertEquals(store.get().count, 1);
});

// ---------------------------------------------------------------------------
// Destroy guard
// ---------------------------------------------------------------------------

Deno.test("destroy is idempotent", () => {
  const store = createStore({}).use({ onDestroy: () => {} });
  store.destroy();
  store.destroy(); // should not throw
});

Deno.test("get throws after destroy", () => {
  const store = createStore({ x: 1 });
  store.destroy();
  assertThrows(() => store.get(), Error, "destroyed");
});

Deno.test("set throws after destroy", () => {
  const store = createStore({ x: 1 });
  store.destroy();
  assertThrows(() => store.set({ x: 2 }), Error, "destroyed");
});

Deno.test("merge throws after destroy", () => {
  const store = createStore({ x: 1 });
  store.destroy();
  assertThrows(() => store.merge({ x: 2 }), Error, "destroyed");
});

Deno.test("subscribe throws after destroy", () => {
  const store = createStore({ x: 1 });
  store.destroy();
  assertThrows(() => store.subscribe(() => {}), Error, "destroyed");
});

Deno.test("use throws after destroy", () => {
  const store = createStore({ x: 1 });
  store.destroy();
  assertThrows(
    () => store.use({ foo: () => 1 }),
    Error,
    "destroyed",
  );
});

Deno.test("a plugin method throws after destroy", () => {
  const store = createStore({}).use({ getDouble: () => 2 });
  store.destroy();
  assertThrows(() => store.getDouble(), Error, "destroyed");
});

Deno.test("this.x() throws after destroy exactly like store.x(), even across an await", async () => {
  // this is bound to the real store object, so this.increment() IS
  // store.increment(), no separate, unguarded path for sibling calls.
  const store = createStore({ count: 0 }).use({
    increment(): void {
      this.set((s) => ({ count: s.count + 1 }));
    },
    async incrementAfterAwait(): Promise<void> {
      await Promise.resolve();
      this.increment();
    },
  });

  const pending = store.incrementAfterAwait();
  store.destroy();
  await assertRejects(() => pending, Error, "destroyed");
});

Deno.test("onDestroy can still call get/set/methods during its own callback", () => {
  let sawCountDuringDestroy: number | undefined;
  const store = createStore({ count: 3 }).use({
    onDestroy() {
      sawCountDuringDestroy = this.get().count;
    },
  });
  store.destroy();
  assertEquals(sawCountDuringDestroy, 3);
});
