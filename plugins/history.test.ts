import { assertEquals } from "@std/assert";
import { createStore } from "@kintools/store-core";
import { history } from "./history.ts";

function makeStore() {
  return createStore({ count: 0 })
    .use({
      increment(n: number): void {
        this.merge((s) => ({ count: s.count + n }));
      },
      setCount(n: number): void {
        this.merge({ count: n });
      },
    })
    .use("history", history());
}

Deno.test("history - canUndo/canRedo initially false", () => {
  const store = makeStore();
  assertEquals(store.history.canUndo(), false);
  assertEquals(store.history.canRedo(), false);
});

Deno.test("history - canUndo true after a change", () => {
  const store = makeStore();
  store.increment(1);
  assertEquals(store.history.canUndo(), true);
});

Deno.test("history - undo restores previous state", () => {
  const store = makeStore();
  store.increment(1);
  store.increment(1);
  store.history.undo();
  assertEquals(store.get().count, 1);
});

Deno.test("history - redo re-applies undone change", () => {
  const store = makeStore();
  store.increment(1);
  store.increment(1);
  store.history.undo();
  store.history.redo();
  assertEquals(store.get().count, 2);
});

Deno.test("history - undo returns true when it moves, false at start", () => {
  const store = makeStore();
  assertEquals(store.history.undo(), false);
  store.increment(1);
  assertEquals(store.history.undo(), true);
  assertEquals(store.get().count, 0);
  assertEquals(store.history.undo(), false);
});

Deno.test("history - redo returns true when it moves, false at end", () => {
  const store = makeStore();
  store.increment(1);
  assertEquals(store.history.redo(), false);
  store.history.undo();
  assertEquals(store.history.redo(), true);
  assertEquals(store.get().count, 1);
  assertEquals(store.history.redo(), false);
});

Deno.test("history - reset returns to initial state and clears history", () => {
  const store = makeStore();
  store.increment(1);
  store.increment(1);
  store.history.reset();
  assertEquals(store.get().count, 0);
  assertEquals(store.history.canUndo(), false);
  assertEquals(store.history.canRedo(), false);
});

Deno.test("history - new change after undo clears redo stack", () => {
  const store = makeStore();
  store.increment(1); // count=1
  store.increment(1); // count=2
  store.history.undo(); // count=1
  store.setCount(99); // count=99 → redo stack cleared
  assertEquals(store.history.canRedo(), false);
  assertEquals(store.get().count, 99);
});

Deno.test("history - set() also recorded in history", () => {
  const store = makeStore();
  store.set({ count: 42 });
  assertEquals(store.history.canUndo(), true);
  store.history.undo();
  assertEquals(store.get().count, 0);
});

Deno.test("history - canRedo false after undo then undo at start", () => {
  const store = makeStore();
  store.increment(1);
  store.history.undo();
  assertEquals(store.history.canUndo(), false);
  assertEquals(store.history.canRedo(), true);
});

Deno.test("history - rebase discards prior history", () => {
  const store = makeStore();
  store.increment(5);
  store.history.rebase();
  assertEquals(store.history.canUndo(), false);
  assertEquals(store.history.canRedo(), false);

  store.increment(1);
  store.history.reset();
  assertEquals(store.get().count, 5);
});

Deno.test("history - limit caps snapshot count", () => {
  const store = createStore({ count: 0 })
    .use({
      setCount(n: number): void {
        this.merge({ count: n });
      },
    })
    .use("history", history({ limit: 3 }));

  store.setCount(1);
  store.setCount(2);
  store.setCount(3); // snapshots: [1, 2, 3], initial 0 was evicted
  assertEquals(store.get().count, 3);
  assertEquals(store.history.canUndo(), true);

  store.history.undo(); // → 2
  store.history.undo(); // → 1
  // Oldest remembered state is 1 (initial 0 was dropped), so canUndo is false
  assertEquals(store.history.canUndo(), false);
  assertEquals(store.get().count, 1);
});

Deno.test("history - limit: reset restores earliest remembered state", () => {
  const store = createStore({ count: 0 })
    .use({
      setCount(n: number): void {
        this.merge({ count: n });
      },
    })
    .use("history", history({ limit: 2 }));

  store.setCount(1);
  store.setCount(2); // snapshots: [1, 2], initial 0 evicted
  store.history.reset();
  assertEquals(store.get().count, 1); // earliest remembered, not original
});

Deno.test("history - multiple undos and redos", () => {
  const store = makeStore();
  store.setCount(1);
  store.setCount(2);
  store.setCount(3);

  store.history.undo(); // → 2
  store.history.undo(); // → 1
  assertEquals(store.get().count, 1);
  assertEquals(store.history.canUndo(), true);

  store.history.redo(); // → 2
  store.history.redo(); // → 3
  assertEquals(store.get().count, 3);
  assertEquals(store.history.canRedo(), false);
});
