import { assertEquals, assertThrows } from "@std/assert";
import { createStore } from "./create-store.ts";
import { derive } from "./derive.ts";

Deno.test("derive - computes initial value", () => {
  const n = createStore(3);
  const doubled = derive((get) => get(n) * 2);
  assertEquals(doubled.get(), 6);
});

Deno.test("derive - recomputes when source changes", () => {
  const n = createStore(3);
  const doubled = derive((get) => get(n) * 2);
  n.set(5);
  assertEquals(doubled.get(), 10);
});

Deno.test("derive - multiple sources", () => {
  const a = createStore("Hello");
  const b = createStore("World");
  const full = derive((get) => `${get(a)} ${get(b)}`);
  assertEquals(full.get(), "Hello World");
  b.set("Deno");
  assertEquals(full.get(), "Hello Deno");
});

Deno.test("derive - subscriber notified when dependency changes", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  let calls = 0;
  doubled.subscribe(() => calls++);
  n.set(2);
  assertEquals(calls, 1);
});

Deno.test("derive - subscriber receives this.get() and prevState", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  let received: { prev: number; next: number } | undefined;
  doubled.subscribe(function (prevState) {
    received = { prev: prevState, next: this.get() };
  });
  n.set(2);
  assertEquals(received, { prev: 2, next: 4 });
});

Deno.test("derive - unsubscribe stops notifications", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  let calls = 0;
  const unsub = doubled.subscribe(() => calls++);
  unsub();
  n.set(2);
  assertEquals(calls, 0);
});

Deno.test(
  "derive - goes cold (no source subscriptions) when last subscriber leaves",
  () => {
    const n = createStore(1);
    let computeCalls = 0;
    const doubled = derive((get) => {
      computeCalls++;
      return get(n) * 2;
    });

    const unsub = doubled.subscribe(() => {});
    computeCalls = 0; // reset after initial subscription read

    unsub();

    // Source change while cold: derived should not recompute proactively
    n.set(5);
    assertEquals(computeCalls, 0);

    // On-demand read should still produce the correct value
    assertEquals(doubled.get(), 10);
    assertEquals(computeCalls, 1);
  },
);

Deno.test(
  "derive - conditional dep: inactive branch changes don't trigger",
  () => {
    const toggle = createStore(true);
    const a = createStore("A");
    const b = createStore("B");
    const result = derive((get) => (get(toggle) ? get(a) : get(b)));

    let calls = 0;
    result.subscribe(() => calls++);

    // toggle is true → only `toggle` and `a` are deps; `b` is not
    b.set("B2");
    assertEquals(calls, 0);
    assertEquals(result.get(), "A");
  },
);

Deno.test("derive - switches tracked deps when branch changes", () => {
  const toggle = createStore(true);
  const a = createStore("A");
  const b = createStore("B");
  const result = derive((get) => (get(toggle) ? get(a) : get(b)));

  const values: string[] = [];
  result.subscribe(function () {
    values.push(this.get());
  });

  toggle.set(false); // now deps are toggle + b
  a.set("A2"); // a is no longer tracked → no notification
  b.set("B2"); // b is now tracked → notification
  assertEquals(values, ["B", "B2"]);
});

Deno.test("derive - destroy prevents get", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  doubled.destroy();
  assertThrows(() => doubled.get(), Error, "destroyed");
});

Deno.test("derive - destroy prevents subscribe", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  doubled.destroy();
  assertThrows(() => doubled.subscribe(() => {}), Error, "destroyed");
});

Deno.test("derive - second destroy throws", () => {
  const n = createStore(1);
  const doubled = derive((get) => get(n) * 2);
  doubled.destroy();
  assertThrows(() => doubled.destroy(), Error, "destroyed");
});

Deno.test(
  "derive - prev() returns previous derived value inside compute",
  () => {
    const delta = createStore(1);
    // Accumulates: each recompute adds delta to the previous total
    // prev() requires an explicit type annotation because TState appears in the
    // parameter list, creating a circular inference dependency.
    const total = derive<number>((get, prev) => (prev() ?? 0) + get(delta));

    const unsub = total.subscribe(() => {});
    assertEquals(total.get(), 1); // 0 + 1
    delta.set(5);
    assertEquals(total.get(), 6); // 1 + 5
    delta.set(3);
    assertEquals(total.get(), 9); // 6 + 3
    unsub();
  },
);

Deno.test(
  "derive - source changes while cold, then re-subscribed computes fresh",
  () => {
    const n = createStore(1);
    const doubled = derive((get) => get(n) * 2);

    const unsub = doubled.subscribe(() => {});
    unsub(); // go cold

    n.set(7);

    let received = 0;
    doubled.subscribe(function () {
      received = this.get();
    });

    n.set(8);
    assertEquals(received, 16);
  },
);

// ---------------------------------------------------------------------------
// Composing derive with derive (a DerivedStore used as a source)
// ---------------------------------------------------------------------------

Deno.test("derive - can use another derived store as a source", () => {
  const n = createStore(2);
  const doubled = derive((get) => get(n) * 2);
  const quadrupled = derive((get) => get(doubled) * 2);

  assertEquals(quadrupled.get(), 8);
  n.set(3);
  assertEquals(quadrupled.get(), 12);
});

Deno.test(
  "derive - can mix a plain store and a derived store as sources",
  () => {
    const n = createStore(2);
    const doubled = derive((get) => get(n) * 2);
    const sum = derive((get) => get(n) + get(doubled));

    assertEquals(sum.get(), 6); // 2 + 4
    n.set(3);
    assertEquals(sum.get(), 9); // 3 + 6
  },
);

Deno.test(
  "derive - subscriber notified when a nested derived store's source changes",
  () => {
    const n = createStore(2);
    const doubled = derive((get) => get(n) * 2);
    const quadrupled = derive((get) => get(doubled) * 2);

    let received: number | undefined;
    quadrupled.subscribe(function () {
      received = this.get();
    });

    n.set(5);
    assertEquals(received, 20);
  },
);

Deno.test(
  "derive - unsubscribing from the outer derive lets the inner derived store go cold too",
  () => {
    const n = createStore(1);
    let innerComputeCalls = 0;
    const doubled = derive((get) => {
      innerComputeCalls++;
      return get(n) * 2;
    });
    const quadrupled = derive((get) => get(doubled) * 2);

    const unsub = quadrupled.subscribe(() => {});
    innerComputeCalls = 0; // Reset after the initial subscription read.

    unsub();

    // Both quadrupled and doubled are cold now; changing n shouldn't
    // proactively recompute the inner derived store.
    n.set(9);
    assertEquals(innerComputeCalls, 0);

    // An on-demand read still produces the correct value, recomputing once.
    assertEquals(quadrupled.get(), 36);
    assertEquals(innerComputeCalls, 1);
  },
);

Deno.test(
  "derive - destroying a nested derived source surfaces as an error on read",
  () => {
    const n = createStore(1);
    const doubled = derive((get) => get(n) * 2);
    const quadrupled = derive((get) => get(doubled) * 2);

    // Establish dependency once, so doubled isn't fresh-computed below.
    quadrupled.get();
    
    doubled.destroy();

    assertThrows(() => quadrupled.get(), Error, "destroyed");
  },
);
