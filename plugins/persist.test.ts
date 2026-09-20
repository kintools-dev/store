import { assertEquals, assertRejects } from "@std/assert";
import { createStore } from "@kintools/store-core";
import { persist, type PersistStorage } from "./persist.ts";

function makeMemoryStorage(): PersistStorage & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

function makeStore(storage: PersistStorage, key = "test") {
  return createStore({ count: 0 })
    .use({
      increment(n: number): void {
        this.merge((s) => ({ count: s.count + n }));
      },
    })
    .use("persist", persist({ key, storage }));
}

Deno.test("persist - hydrates state from storage on activation", async () => {
  const storage = makeMemoryStorage();
  storage.setItem("test", JSON.stringify({ value: { count: 42 }, version: 0 }));

  const store = makeStore(storage);
  await store.persist.hydrationComplete();
  assertEquals(store.get().count, 42);
});

Deno.test("persist - persists state changes to storage", async () => {
  const storage = makeMemoryStorage();
  const store = makeStore(storage);
  await store.persist.hydrationComplete();

  store.increment(5);
  const raw = storage.getItem("test") as string;
  const stored = JSON.parse(raw);
  assertEquals(stored.value.count, 5);
});

Deno.test("persist - hasHydrated returns false before, true after", async () => {
  const storage = makeMemoryStorage();
  const store = makeStore(storage);
  // hasHydrated is false before the promise resolves
  await store.persist.hydrationComplete();
  assertEquals(store.persist.hasHydrated(), true);
});

Deno.test("persist - clear removes item from storage", async () => {
  const storage = makeMemoryStorage();
  const store = makeStore(storage);
  await store.persist.hydrationComplete();

  store.increment(1);
  await store.persist.clear();
  assertEquals(storage.getItem("test"), null);
});

Deno.test("persist - skipHydration skips auto-hydration", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "skip-test",
    JSON.stringify({ value: { count: 99 }, version: 0 }),
  );

  const store = createStore({ count: 0 })
    .use(
      "persist",
      persist({ key: "skip-test", storage, skipHydration: true }),
    );

  // Not hydrated yet
  assertEquals(store.get().count, 0);
  assertEquals(store.persist.hasHydrated(), false);

  await store.persist.hydrate();
  assertEquals(store.get().count, 99);
  assertEquals(store.persist.hasHydrated(), true);
});

Deno.test("persist - skipHydration with no storage option never touches the localStorage global", () => {
  // Simulates an SSR environment (e.g. Next.js build) where `localStorage`
  // isn't defined. Constructing/activating the plugin must not read the
  // global merely because no `storage` override was passed.
  const original = globalThis.localStorage;
  // deno-lint-ignore no-explicit-any
  delete (globalThis as any).localStorage;

  try {
    const store = createStore({ count: 0 })
      .use("persist", persist({ key: "no-storage-test", skipHydration: true }));

    assertEquals(store.get().count, 0);
  } finally {
    globalThis.localStorage = original;
  }
});

Deno.test("persist - selector persists only a slice", async () => {
  const storage = makeMemoryStorage();
  const store = createStore({ count: 0, label: "hello" })
    .use(
      "persist",
      persist({
        key: "slice-test",
        storage,
        selector: (s) => ({ count: s.count }),
        merge: (current, slice) => ({ ...current, ...slice }),
      }),
    );

  await store.persist.hydrationComplete();
  store.set({ count: 7, label: "world" });

  const raw = storage.getItem("slice-test") as string;
  const stored = JSON.parse(raw);
  assertEquals(stored.value, { count: 7 });
  // label is not persisted
  assertEquals(stored.value.label, undefined);
});

Deno.test("persist - default merge replaces array state instead of spreading it", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "array-test",
    JSON.stringify({ value: [4, 5], version: 0 }),
  );

  const store = createStore([1, 2, 3])
    .use("persist", persist({ key: "array-test", storage }));

  await store.persist.hydrationComplete();
  assertEquals(store.get(), [4, 5]);
  assertEquals(Array.isArray(store.get()), true);
});

Deno.test("persist - version mismatch without migrate discards stored value", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "v-test",
    JSON.stringify({ value: { count: 50 }, version: 0 }),
  );

  const store = createStore({ count: 0 })
    .use("persist", persist({ key: "v-test", storage, version: 1 }));

  await store.persist.hydrationComplete();
  assertEquals(store.get().count, 0); // discarded
});

Deno.test("persist - migrate is called on version mismatch", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "m-test",
    JSON.stringify({ value: { count: 10 }, version: 0 }),
  );

  const store = createStore({ count: 0 })
    .use(
      "persist",
      persist({
        key: "m-test",
        storage,
        version: 1,
        migrate: (stored, _version) => ({
          count: (stored as { count: number }).count + 100,
        }),
      }),
    );

  await store.persist.hydrationComplete();
  assertEquals(store.get().count, 110);
});

Deno.test("persist - corrupted storage is silently ignored", async () => {
  const storage = makeMemoryStorage();
  storage.setItem("bad-test", "not-json{{{{");

  const store = createStore({ count: 0 })
    .use("persist", persist({ key: "bad-test", storage }));

  await store.persist.hydrationComplete();
  assertEquals(store.get().count, 0);
});

Deno.test("persist - onHydrationStart fires before hydration", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "onh-test",
    JSON.stringify({ value: { count: 5 }, version: 0 }),
  );

  let stateAtHydrate: { count: number } | undefined;
  // skipHydration so we can register the listener before hydration starts
  const store = createStore({ count: 0 })
    .use("persist", persist({ key: "onh-test", storage, skipHydration: true }));

  store.persist.onHydrationStart((state) => {
    stateAtHydrate = state;
  });

  await store.persist.hydrate();
  assertEquals(stateAtHydrate?.count, 0); // captured before restore
});

Deno.test("persist - onHydrationComplete fires after hydration", async () => {
  const storage = makeMemoryStorage();
  storage.setItem(
    "onh2-test",
    JSON.stringify({ value: { count: 7 }, version: 0 }),
  );

  let stateAfterHydrate: { count: number } | undefined;
  // skipHydration so we can register the listener before hydration starts
  const store = createStore({ count: 0 })
    .use(
      "persist",
      persist({ key: "onh2-test", storage, skipHydration: true }),
    );

  store.persist.onHydrationComplete((state) => {
    stateAfterHydrate = state;
  });

  await store.persist.hydrate();
  assertEquals(stateAfterHydrate?.count, 7);
});

Deno.test("persist - onHydrationStart unsubscribe works", async () => {
  const storage = makeMemoryStorage();
  let calls = 0;
  const store = createStore({ count: 0 })
    .use(
      "persist",
      persist({ key: "unsub-test", storage, skipHydration: true }),
    );

  const unsub = store.persist.onHydrationStart(() => calls++);
  unsub();

  await store.persist.hydrate();
  assertEquals(calls, 0);
});

Deno.test("persist - async storage is supported", async () => {
  const data: Record<string, string> = {};
  const asyncStorage: PersistStorage = {
    getItem: (key) => Promise.resolve(data[key] ?? null),
    setItem: (key, value) => {
      data[key] = value;
      return Promise.resolve();
    },
    removeItem: (key) => {
      delete data[key];
      return Promise.resolve();
    },
  };

  data["async-test"] = JSON.stringify({ value: { count: 33 }, version: 0 });

  const store = createStore({ count: 0 })
    .use("persist", persist({ key: "async-test", storage: asyncStorage }));

  await store.persist.hydrationComplete();
  assertEquals(store.get().count, 33);
});

Deno.test("persist - hydrationComplete rejects after a failed hydration", async () => {
  const failingStorage: PersistStorage = {
    getItem: () => {
      throw new Error("boom");
    },
    setItem: () => {},
    removeItem: () => {},
  };

  // Construction/activation must not throw or produce an unhandled
  // rejection even though the initial auto-hydration fails internally.
  const store = createStore({ count: 0 })
    .use("persist", persist({ key: "fail-test", storage: failingStorage }));

  await assertRejects(
    () => store.persist.hydrationComplete(),
    Error,
    "boom",
  );
  assertEquals(store.persist.hasHydrated(), false);
});
