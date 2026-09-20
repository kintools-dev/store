import { assertEquals } from "@std/assert";
import { createStore } from "@kintools/store-core";
import { broadcast } from "./broadcast.ts";

type CounterState = { count: number };

function makeStore(name: string) {
  return createStore<CounterState>({ count: 0 })
    .use({
      increment(n: number): void {
        this.merge((s) => ({ count: s.count + n }));
      },
    })
    .use("broadcast", broadcast({ name }));
}

function waitForCount(
  store: {
    subscribe(listener: () => void): () => void;
    get(): CounterState;
  },
  count: number,
): Promise<void> {
  if (store.get().count === count) return Promise.resolve();

  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (store.get().count === count) {
        unsubscribe();
        resolve();
      }
    });
  });
}

Deno.test("broadcast - propagates a state change to another store on the same channel", async () => {
  const name = crypto.randomUUID();
  const a = makeStore(name);
  const b = makeStore(name);

  a.increment(5);

  await waitForCount(b, 5);
  assertEquals(b.get().count, 5);

  a.destroy();
  b.destroy();
});

Deno.test("broadcast - does not sync stores on a different channel name", async () => {
  const a = makeStore(crypto.randomUUID());
  const b = makeStore(crypto.randomUUID());

  a.increment(5);
  await new Promise((resolve) => setTimeout(resolve, 50));

  assertEquals(a.get().count, 5);
  assertEquals(b.get().count, 0);

  a.destroy();
  b.destroy();
});

Deno.test("broadcast - a store opened after a change still catches up", async () => {
  const name = crypto.randomUUID();
  const a = makeStore(name);
  a.increment(7);

  const b = makeStore(name);

  await waitForCount(b, 7);
  assertEquals(b.get().count, 7);

  a.destroy();
  b.destroy();
});

Deno.test("broadcast - close() stops receiving further updates", async () => {
  const name = crypto.randomUUID();
  const a = makeStore(name);
  const b = makeStore(name);

  a.increment(1);
  await waitForCount(b, 1);

  b.broadcast.close();

  a.increment(1);
  await new Promise((resolve) => setTimeout(resolve, 50));

  assertEquals(a.get().count, 2);
  assertEquals(b.get().count, 1);

  a.destroy();
  b.destroy();
});

Deno.test("broadcast - applying an incoming state does not rebroadcast it back and forth", async () => {
  const name = crypto.randomUUID();
  const a = makeStore(name);
  const b = makeStore(name);

  let bUpdates = 0;
  b.subscribe(() => bUpdates++);

  a.increment(3);
  await waitForCount(b, 3);

  // Let any runaway ping-pong between a and b play out before asserting.
  await new Promise((resolve) => setTimeout(resolve, 100));

  assertEquals(a.get().count, 3);
  assertEquals(b.get().count, 3);
  assertEquals(bUpdates, 1);

  a.destroy();
  b.destroy();
});

Deno.test("broadcast - destroy() closes the channel without throwing", async () => {
  const name = crypto.randomUUID();
  const a = makeStore(name);
  const b = makeStore(name);

  a.increment(1);
  await waitForCount(b, 1);

  a.destroy();

  // b keeps working normally after a's channel is torn down.
  b.increment(1);
  assertEquals(b.get().count, 2);

  b.destroy();
});
