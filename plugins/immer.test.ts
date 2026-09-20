import { assertEquals } from "@std/assert";
import { createStore } from "@kintools/store-core";
import { immer } from "./immer.ts";

Deno.test("immer - a method mutates the draft to produce new state", () => {
  const store = createStore({ count: 0 }).use(
    immer({
      increment(amount: number): void {
        this.set((draft) => {
          draft.count += amount;
        });
      },
    }),
  );

  store.increment(3);
  assertEquals(store.get().count, 3);
});

Deno.test("immer - multiple methods", () => {
  const store = createStore({ count: 0, items: [] as string[] }).use(
    immer({
      increment(n: number): void {
        this.set((draft) => {
          draft.count += n;
        });
      },
      addItem(item: string): void {
        this.set((draft) => {
          draft.items.push(item);
        });
      },
    }),
  );

  store.increment(2);
  store.addItem("hello");
  assertEquals(store.get(), { count: 2, items: ["hello"] });
});

Deno.test("immer - original state is not mutated", () => {
  const initial = { count: 0 };
  const store = createStore(initial).use(
    immer({
      increment(): void {
        this.set((draft) => {
          draft.count++;
        });
      },
    }),
  );

  store.increment();
  assertEquals(initial.count, 0); // untouched
});

Deno.test("immer - reset combines with increment via a second recipe", () => {
  const store = createStore({ count: 0, items: [] as string[] }).use(
    immer({
      increment(n: number): void {
        this.set((draft) => {
          draft.count += n;
        });
      },
      reset(): void {
        this.set((draft) => {
          draft.count = 0;
          draft.items = [];
        });
      },
    }),
  );

  store.increment(5);
  store.reset();
  assertEquals(store.get(), { count: 0, items: [] });
});

Deno.test("immer - namespaced immer plugin", () => {
  const store = createStore({ todos: [] as { title: string; done: boolean }[] })
    .use(
      "todos",
      immer({
        add(title: string): void {
          this.set((draft) => {
            draft.todos.push({ title, done: false });
          });
        },
        complete(index: number): void {
          this.set((draft) => {
            draft.todos[index].done = true;
          });
        },
      }),
    );

  store.todos.add("Buy milk");
  store.todos.complete(0);
  assertEquals(store.get().todos[0], { title: "Buy milk", done: true });
});

Deno.test("immer - onActivated receives immer-wrapped store", () => {
  let stateAtActivation: { count: number } | undefined;

  createStore({ count: 7 }).use(
    immer({
      onActivated() {
        stateAtActivation = this.get();
      },
    }),
  );

  assertEquals(stateAtActivation?.count, 7);
});

Deno.test("immer - a method calls a sibling method via this", () => {
  const store = createStore({ count: 0 }).use(
    immer({
      increment(n: number): void {
        this.set((draft) => {
          draft.count += n;
        });
      },
      incrementTwice(n: number): void {
        this.increment(n);
        this.increment(n);
      },
    }),
  );

  store.incrementTwice(3);
  assertEquals(store.get().count, 6);
});

Deno.test("immer - array push via draft does not share refs across calls", () => {
  const store = createStore({ items: [] as number[] }).use(
    immer({
      push(n: number): void {
        this.set((draft) => {
          draft.items.push(n);
        });
      },
    }),
  );

  store.push(1);
  const snap1 = store.get().items;
  store.push(2);
  const snap2 = store.get().items;

  assertEquals(snap1, [1]);
  assertEquals(snap2, [1, 2]);
  assertEquals(snap1 === snap2, false); // different references
});
