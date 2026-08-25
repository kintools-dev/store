/**
 * Kin Store's speed-benchmark harness for the plain `createStore` tier
 * (`store.set(updater)`), the tier comparable to Zustand/Jotai/MobX's own
 * direct-mutation APIs. See `kin-store-dispatch.harness.tsx` for the
 * `withPlugins`/`dispatch` tier instead, and `harness.ts` for the contract
 * and `speed-bench.ts` for how these methods get driven and averaged.
 */

// deno-lint-ignore-file require-await -- internal measurement script: every
// SpeedHarness method is async uniformly even where a given scenario happens
// not to need an await.

import { act, cleanup, render } from "@testing-library/react";
import {
  createStore,
  derive,
  type DerivedStore,
  type Store,
} from "@kintools/store-core";
import { useSelector, useStore } from "@kintools/store-react";
import {
  allFieldKeys,
  allItemKeys,
  type CounterState,
  FIELD_COUNT,
  fieldKey,
  ITEM_COUNT,
  itemKey,
  makeInitialState,
  type Metrics,
  UPDATE_BURST_SIZE,
} from "./scenario.ts";
import {
  bump,
  type Counters,
  makeCounterMap,
  postMountRenders,
  resetCounters,
  sumPostMountRenders,
} from "./render-count.ts";
import type { SpeedHarness } from "./harness.ts";

function counterKeys(): string[] {
  return [...allFieldKeys(), ...allItemKeys(), "sum"];
}

function Field(
  { store, index, counters }: {
    store: Store<CounterState>;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, fieldKey(index));
  useSelector(store, (s) => s.fields[index]);
  return null;
}

function Item(
  { store, index, counters }: {
    store: Store<CounterState>;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, itemKey(index));
  useSelector(store, (s) => s.items[index]);
  return null;
}

function Sum(
  { sum, counters }: { sum: DerivedStore<number>; counters: Counters },
) {
  bump(counters, "sum");
  useStore(sum);
  return null;
}

function App(
  { store, sum, counters }: {
    store: Store<CounterState>;
    sum: DerivedStore<number>;
    counters: Counters;
  },
) {
  return (
    <>
      {Array.from(
        { length: FIELD_COUNT },
        (_, i) => <Field key={i} store={store} index={i} counters={counters} />,
      )}
      <Sum sum={sum} counters={counters} />
      {Array.from(
        { length: ITEM_COUNT },
        (_, i) => <Item key={i} store={store} index={i} counters={counters} />,
      )}
    </>
  );
}

function setup(): { store: Store<CounterState>; sum: DerivedStore<number> } {
  const store = createStore(makeInitialState());
  const sum = derive<number>((get) =>
    get(store).fields.reduce((a, b) => a + b, 0)
  );
  return { store, sum };
}

function incField(store: Store<CounterState>, index: number): void {
  store.set((s) => ({
    ...s,
    fields: s.fields.map((v, i) => i === index ? v + 1 : v),
  }));
}

function swapItems(store: Store<CounterState>, a: number, b: number): void {
  store.set((s) => {
    const items = s.items.slice();
    [items[a], items[b]] = [items[b], items[a]];
    return { ...s, items };
  });
}

export const kinStoreHarness: SpeedHarness = {
  name: "Kin Store (set)",

  async mount(): Promise<Metrics> {
    const { store, sum } = setup();
    const counters = makeCounterMap(counterKeys());
    const start = performance.now();
    const { unmount } = render(
      <App store={store} sum={sum} counters={counters} />,
    );
    const wallMs = performance.now() - start;
    unmount();
    cleanup();
    return { wallMs };
  },

  async updateOneField(): Promise<Metrics> {
    const { store, sum } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App store={store} sum={sum} counters={counters} />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) incField(store, 0);
    });
    const wallMs = performance.now() - start;

    const updatedRenders = postMountRenders(counters, fieldKey(0));
    const siblingRenders = sumPostMountRenders(
      counters,
      allFieldKeys().filter((k) => k !== fieldKey(0)),
    );
    const sumRenders = postMountRenders(counters, "sum");

    unmount();
    cleanup();
    return { wallMs, updatedRenders, siblingRenders, sumRenders };
  },

  async updateAllFields(): Promise<Metrics> {
    const { store, sum } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App store={store} sum={sum} counters={counters} />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        incField(store, i % FIELD_COUNT);
      }
    });
    const wallMs = performance.now() - start;

    const totalFieldRenders = sumPostMountRenders(counters, allFieldKeys());
    const sumRenders = postMountRenders(counters, "sum");

    unmount();
    cleanup();
    return { wallMs, totalFieldRenders, sumRenders };
  },

  async swapItems(): Promise<Metrics> {
    const { store, sum } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App store={store} sum={sum} counters={counters} />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      // Cycles through adjacent pairs rather than swapping the same two
      // repeatedly: an even-length repeat of the same swap is a no-op
      // permutation, which (combined with React's automatic batching of a
      // synchronous burst into one final render) would trivially collapse to
      // "nothing changed" and measure a batching artifact instead of real
      // reorder cost.
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        const a = i % (ITEM_COUNT - 1);
        swapItems(store, a, a + 1);
      }
    });
    const wallMs = performance.now() - start;

    const itemRenders = sumPostMountRenders(counters, allItemKeys());

    unmount();
    cleanup();
    return { wallMs, itemRenders };
  },
};
