/**
 * Redux Toolkit's speed-benchmark harness; see `harness.ts` for the contract
 * and `speed-bench.ts` for how these methods get driven and averaged. Uses
 * `configureStore` + one `createSlice` (Immer-backed reducers) and
 * `react-redux`'s `useSelector`/`Provider` for the field/item/sum
 * subscriptions.
 */

// deno-lint-ignore-file require-await -- internal measurement script: every
// SpeedHarness method is async uniformly even where a given scenario happens
// not to need an await.

import { act, cleanup, render } from "@testing-library/react";
import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { Provider, useSelector } from "react-redux";
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

const slice = createSlice({
  name: "counters",
  initialState: makeInitialState(),
  reducers: {
    incField(state, action: PayloadAction<number>) {
      state.fields[action.payload] += 1;
    },
    swapItems(state, action: PayloadAction<[number, number]>) {
      const [a, b] = action.payload;
      const tmp = state.items[a];
      state.items[a] = state.items[b];
      state.items[b] = tmp;
    },
  },
});

function counterKeys(): string[] {
  return [...allFieldKeys(), ...allItemKeys(), "sum"];
}

function Field({ index, counters }: { index: number; counters: Counters }) {
  bump(counters, fieldKey(index));
  useSelector((s: CounterState) => s.fields[index]);
  return null;
}

function Item({ index, counters }: { index: number; counters: Counters }) {
  bump(counters, itemKey(index));
  useSelector((s: CounterState) => s.items[index]);
  return null;
}

function Sum({ counters }: { counters: Counters }) {
  bump(counters, "sum");
  useSelector((s: CounterState) => s.fields.reduce((a, b) => a + b, 0));
  return null;
}

function App({ counters }: { counters: Counters }) {
  return (
    <>
      {Array.from(
        { length: FIELD_COUNT },
        (_, i) => <Field key={i} index={i} counters={counters} />,
      )}
      <Sum counters={counters} />
      {Array.from(
        { length: ITEM_COUNT },
        (_, i) => <Item key={i} index={i} counters={counters} />,
      )}
    </>
  );
}

function setup() {
  const store = configureStore({ reducer: slice.reducer });
  return { store };
}

export const reduxHarness: SpeedHarness = {
  name: "Redux Toolkit",

  async mount(): Promise<Metrics> {
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const start = performance.now();
    const { unmount } = render(
      <Provider store={store}>
        <App counters={counters} />
      </Provider>,
    );
    const wallMs = performance.now() - start;
    unmount();
    cleanup();
    return { wallMs };
  },

  async updateOneField(): Promise<Metrics> {
    const { store } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <Provider store={store}>
        <App counters={counters} />
      </Provider>,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        store.dispatch(slice.actions.incField(0));
      }
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
    const { unmount } = render(
      <Provider store={store}>
        <App counters={counters} />
      </Provider>,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        store.dispatch(slice.actions.incField(i % FIELD_COUNT));
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
    const { unmount } = render(
      <Provider store={store}>
        <App counters={counters} />
      </Provider>,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        const a = i % (ITEM_COUNT - 1);
        store.dispatch(slice.actions.swapItems([a, a + 1]));
      }
    });
    const wallMs = performance.now() - start;

    const itemRenders = sumPostMountRenders(counters, allItemKeys());

    unmount();
    cleanup();
    return { wallMs, itemRenders };
  },
};
