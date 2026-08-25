/**
 * Zustand's speed-benchmark harness; see `harness.ts` for the contract and
 * `speed-bench.ts` for how these methods get driven and averaged. Uses
 * Zustand's vanilla store (`createStore`) bound into React via `useStore`
 * with a per-field selector, the same fine-grained-subscription shape as the
 * Kin Store harness.
 */

// deno-lint-ignore-file require-await -- internal measurement script: every
// SpeedHarness method is async uniformly even where a given scenario happens
// not to need an await.

import { act, cleanup, render } from "@testing-library/react";
import { createStore, type StoreApi, useStore } from "zustand";
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

type ZustandStore = StoreApi<CounterState>;

function counterKeys(): string[] {
  return [...allFieldKeys(), ...allItemKeys(), "sum"];
}

function Field(
  { store, index, counters }: {
    store: ZustandStore;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, fieldKey(index));
  useStore(store, (s) => s.fields[index]);
  return null;
}

function Item(
  { store, index, counters }: {
    store: ZustandStore;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, itemKey(index));
  useStore(store, (s) => s.items[index]);
  return null;
}

function Sum({ store, counters }: { store: ZustandStore; counters: Counters }) {
  bump(counters, "sum");
  useStore(store, (s) => s.fields.reduce((a, b) => a + b, 0));
  return null;
}

function App(
  { store, counters }: { store: ZustandStore; counters: Counters },
) {
  return (
    <>
      {Array.from(
        { length: FIELD_COUNT },
        (_, i) => <Field key={i} store={store} index={i} counters={counters} />,
      )}
      <Sum store={store} counters={counters} />
      {Array.from(
        { length: ITEM_COUNT },
        (_, i) => <Item key={i} store={store} index={i} counters={counters} />,
      )}
    </>
  );
}

function setup(): { store: ZustandStore } {
  const store = createStore<CounterState>(() => makeInitialState());
  return { store };
}

function incField(store: ZustandStore, index: number): void {
  store.setState((s) => ({
    fields: s.fields.map((v, i) => i === index ? v + 1 : v),
  }));
}

function swapItems(store: ZustandStore, a: number, b: number): void {
  store.setState((s) => {
    const items = s.items.slice();
    [items[a], items[b]] = [items[b], items[a]];
    return { items };
  });
}

export const zustandHarness: SpeedHarness = {
  name: "Zustand",

  async mount(): Promise<Metrics> {
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const start = performance.now();
    const { unmount } = render(<App store={store} counters={counters} />);
    const wallMs = performance.now() - start;
    unmount();
    cleanup();
    return { wallMs };
  },

  async updateOneField(): Promise<Metrics> {
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(<App store={store} counters={counters} />);
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
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(<App store={store} counters={counters} />);
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
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(<App store={store} counters={counters} />);
    resetCounters(counters);

    const start = performance.now();
    act(() => {
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
