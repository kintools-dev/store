/**
 * MobX's speed-benchmark harness; see `harness.ts` for the contract and
 * `speed-bench.ts` for how these methods get driven and averaged. State is
 * one auto-observable class instance, mutated in place (`runInAction`) and
 * read directly inside `observer` components — MobX's own fine-grained
 * dependency tracking replaces the explicit per-field selectors the other
 * harnesses need.
 */

// deno-lint-ignore-file require-await -- internal measurement script: every
// SpeedHarness method is async uniformly even where a given scenario happens
// not to need an await.

import { act, cleanup, render } from "@testing-library/react";
import { makeAutoObservable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import {
  allFieldKeys,
  allItemKeys,
  FIELD_COUNT,
  fieldKey,
  type Item,
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

class CounterStore {
  fields: number[];
  items: Item[];

  constructor() {
    const initial = makeInitialState();
    this.fields = initial.fields;
    this.items = initial.items;
    makeAutoObservable(this);
  }

  get sum(): number {
    return this.fields.reduce((a, b) => a + b, 0);
  }
}

function counterKeys(): string[] {
  return [...allFieldKeys(), ...allItemKeys(), "sum"];
}

const Field = observer(
  function Field(
    { store, index, counters }: {
      store: CounterStore;
      index: number;
      counters: Counters;
    },
  ) {
    bump(counters, fieldKey(index));
    void store.fields[index];
    return null;
  },
);

const ItemView = observer(
  function ItemView(
    { store, index, counters }: {
      store: CounterStore;
      index: number;
      counters: Counters;
    },
  ) {
    bump(counters, itemKey(index));
    void store.items[index];
    return null;
  },
);

const Sum = observer(
  function Sum(
    { store, counters }: { store: CounterStore; counters: Counters },
  ) {
    bump(counters, "sum");
    void store.sum;
    return null;
  },
);

function App({ store, counters }: { store: CounterStore; counters: Counters }) {
  return (
    <>
      {Array.from(
        { length: FIELD_COUNT },
        (_, i) => <Field key={i} store={store} index={i} counters={counters} />,
      )}
      <Sum store={store} counters={counters} />
      {Array.from(
        { length: ITEM_COUNT },
        (_, i) => (
          <ItemView key={i} store={store} index={i} counters={counters} />
        ),
      )}
    </>
  );
}

function setup(): { store: CounterStore } {
  return { store: new CounterStore() };
}

function incField(store: CounterStore, index: number): void {
  runInAction(() => {
    store.fields[index] += 1;
  });
}

function swapItems(store: CounterStore, a: number, b: number): void {
  runInAction(() => {
    const tmp = store.items[a];
    store.items[a] = store.items[b];
    store.items[b] = tmp;
  });
}

export const mobxHarness: SpeedHarness = {
  name: "MobX",

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
