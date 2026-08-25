/**
 * Jotai's speed-benchmark harness; see `harness.ts` for the contract and
 * `speed-bench.ts` for how these methods get driven and averaged. Each field
 * and item gets its own independent, individually-settable atom via
 * `atomFamily` — Jotai's own recommended pattern for a dynamic collection of
 * independently-updatable values — rather than one shared source atom with
 * derived per-field reads (which would mark every derived atom dirty on any
 * single field's update, since they'd all depend on the same underlying
 * atom).
 */

// deno-lint-ignore-file require-await -- internal measurement script: every
// SpeedHarness method is async uniformly even where a given scenario happens
// not to need an await.

import { act, cleanup, render } from "@testing-library/react";
import {
  type Atom,
  atom,
  createStore,
  type PrimitiveAtom,
  useAtomValue,
} from "jotai";
// jotai/utils' own `atomFamily` is deprecated as of jotai v2; the jotai
// team's replacement lives in this separate package instead.
import { atomFamily } from "jotai-family";
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

type JotaiStore = ReturnType<typeof createStore>;

function counterKeys(): string[] {
  return [...allFieldKeys(), ...allItemKeys(), "sum"];
}

function Field(
  { store, fieldAtom, index, counters }: {
    store: JotaiStore;
    fieldAtom: PrimitiveAtom<number>;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, fieldKey(index));
  useAtomValue(fieldAtom, { store });
  return null;
}

function ItemView(
  { store, itemAtom, index, counters }: {
    store: JotaiStore;
    itemAtom: PrimitiveAtom<Item>;
    index: number;
    counters: Counters;
  },
) {
  bump(counters, itemKey(index));
  useAtomValue(itemAtom, { store });
  return null;
}

function Sum(
  { store, sumAtom, counters }: {
    store: JotaiStore;
    sumAtom: Atom<number>;
    counters: Counters;
  },
) {
  bump(counters, "sum");
  useAtomValue(sumAtom, { store });
  return null;
}

function App(
  { store, fieldAtoms, itemAtoms, sumAtom, counters }: {
    store: JotaiStore;
    fieldAtoms: PrimitiveAtom<number>[];
    itemAtoms: PrimitiveAtom<Item>[];
    sumAtom: Atom<number>;
    counters: Counters;
  },
) {
  return (
    <>
      {fieldAtoms.map((fieldAtom, i) => (
        <Field
          key={i}
          store={store}
          fieldAtom={fieldAtom}
          index={i}
          counters={counters}
        />
      ))}
      <Sum store={store} sumAtom={sumAtom} counters={counters} />
      {itemAtoms.map((itemAtom, i) => (
        <ItemView
          key={i}
          store={store}
          itemAtom={itemAtom}
          index={i}
          counters={counters}
        />
      ))}
    </>
  );
}

// Each field/item gets its own independent, individually-settable atom
// (Jotai's recommended shape for a dynamic collection — see the module
// comment). `sumAtom` is the one atom that legitimately depends on every
// field atom, so it recomputes on every field update regardless.
function setup() {
  const store = createStore();
  const initial = makeInitialState();

  const fieldFamily = atomFamily((index: number) =>
    atom(initial.fields[index])
  );
  const itemFamily = atomFamily((index: number) => atom(initial.items[index]));

  const fieldAtoms = Array.from(
    { length: FIELD_COUNT },
    (_, i) => fieldFamily(i),
  );
  const itemAtoms = Array.from(
    { length: ITEM_COUNT },
    (_, i) => itemFamily(i),
  );
  const sumAtom = atom(
    (get) => fieldAtoms.reduce((total, a) => total + get(a), 0),
  );

  return { store, fieldAtoms, itemAtoms, sumAtom };
}

function incField(
  store: JotaiStore,
  fieldAtoms: PrimitiveAtom<number>[],
  index: number,
): void {
  store.set(fieldAtoms[index], (v) => v + 1);
}

function swapItems(
  store: JotaiStore,
  itemAtoms: PrimitiveAtom<Item>[],
  a: number,
  b: number,
): void {
  const itemA = store.get(itemAtoms[a]);
  const itemB = store.get(itemAtoms[b]);
  store.set(itemAtoms[a], itemB);
  store.set(itemAtoms[b], itemA);
}

export const jotaiHarness: SpeedHarness = {
  name: "Jotai",

  async mount(): Promise<Metrics> {
    const { store, fieldAtoms, itemAtoms, sumAtom } = setup();
    const counters = makeCounterMap(counterKeys());
    const start = performance.now();
    const { unmount } = render(
      <App
        store={store}
        fieldAtoms={fieldAtoms}
        itemAtoms={itemAtoms}
        sumAtom={sumAtom}
        counters={counters}
      />,
    );
    const wallMs = performance.now() - start;
    unmount();
    cleanup();
    return { wallMs };
  },

  async updateOneField(): Promise<Metrics> {
    const { store, fieldAtoms, itemAtoms, sumAtom } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App
        store={store}
        fieldAtoms={fieldAtoms}
        itemAtoms={itemAtoms}
        sumAtom={sumAtom}
        counters={counters}
      />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        incField(store, fieldAtoms, 0);
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
    const { store, fieldAtoms, itemAtoms, sumAtom } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App
        store={store}
        fieldAtoms={fieldAtoms}
        itemAtoms={itemAtoms}
        sumAtom={sumAtom}
        counters={counters}
      />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        incField(store, fieldAtoms, i % FIELD_COUNT);
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
    const { store, fieldAtoms, itemAtoms, sumAtom } = setup();
    const counters = makeCounterMap(counterKeys());
    const { unmount } = render(
      <App
        store={store}
        fieldAtoms={fieldAtoms}
        itemAtoms={itemAtoms}
        sumAtom={sumAtom}
        counters={counters}
      />,
    );
    resetCounters(counters);

    const start = performance.now();
    act(() => {
      for (let i = 0; i < UPDATE_BURST_SIZE; i++) {
        const a = i % (ITEM_COUNT - 1);
        swapItems(store, itemAtoms, a, a + 1);
      }
    });
    const wallMs = performance.now() - start;

    const itemRenders = sumPostMountRenders(counters, allItemKeys());

    unmount();
    cleanup();
    return { wallMs, itemRenders };
  },
};
