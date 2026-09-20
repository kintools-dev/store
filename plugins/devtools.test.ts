import { assertEquals } from "@std/assert";
import { createStore } from "@kintools/store-core";
import { devtools } from "./devtools.ts";

type Action = { type: string; [key: string]: unknown };
type Msg =
  | {
    type: "DISPATCH";
    state: string;
    payload:
      | { type: string; index?: number; id?: number }
      | {
        type: "IMPORT_STATE";
        nextLiftedState: {
          computedStates: { state: unknown }[];
          currentStateIndex: number;
        };
      };
  }
  | { type: "ACTION"; payload: string }
  | { type: "START" | "STOP" };

function makeExtension() {
  let listener: ((msg: Msg) => void) | null = null;
  let unsubscribed = false;
  const inits: unknown[] = [];
  const sends: [Action, unknown][] = [];

  const connection = {
    init: (state: unknown) => inits.push(state),
    send: (action: Action, state: unknown) => sends.push([action, state]),
    subscribe: (fn: (msg: Msg) => void) => {
      listener = fn;
      return () => {};
    },
    unsubscribe: () => {
      unsubscribed = true;
    },
    error: () => {},
  };

  function simulate(msg: Msg) {
    listener?.(msg);
  }

  function jump(state: unknown) {
    simulate({
      type: "DISPATCH",
      state: JSON.stringify(state),
      payload: { type: "JUMP_TO_STATE", index: 0 },
    });
  }

  function wasUnsubscribed() {
    return unsubscribed;
  }

  return {
    ext: { connect: () => connection },
    inits,
    sends,
    simulate,
    jump,
    wasUnsubscribed,
  };
}

function setup() {
  const fake = makeExtension();
  // deno-lint-ignore no-explicit-any
  (globalThis as any).__REDUX_DEVTOOLS_EXTENSION__ = fake.ext;

  const store = createStore({ count: 0 })
    .use({
      increment(n: number): void {
        this.merge((s) => ({ count: s.count + n }));
      },
    })
    .use("devtools", devtools());

  return { store, ...fake };
}

function teardown() {
  // deno-lint-ignore no-explicit-any
  delete (globalThis as any).__REDUX_DEVTOOLS_EXTENSION__;
}

Deno.test("devtools - init called with initial state on activation", () => {
  const { inits } = setup();
  assertEquals(inits, [{ count: 0 }]);
  teardown();
});

Deno.test("devtools - send called with @@CHANGE and the new state after calling a method", () => {
  const { store, sends } = setup();
  store.increment(5);
  assertEquals(sends, [[{ type: "@@CHANGE" }, { count: 5 }]]);
  teardown();
});

Deno.test("devtools - send called with @@CHANGE and the new state after store.set()", () => {
  const { store, sends } = setup();
  store.set({ count: 42 });
  assertEquals(sends, [[{ type: "@@CHANGE" }, { count: 42 }]]);
  teardown();
});

Deno.test("devtools - send called with @@CHANGE and the new state after store.merge()", () => {
  const { store, sends } = setup();
  store.merge({ count: 42 });
  assertEquals(sends, [[{ type: "@@CHANGE" }, { count: 42 }]]);
  teardown();
});

Deno.test("devtools - JUMP_TO_STATE restores state without sending to devtools", () => {
  const { store, sends, jump } = setup();
  jump({ count: 99 });
  assertEquals(store.get(), { count: 99 });
  assertEquals(sends.length, 0);
  teardown();
});

Deno.test("devtools - JUMP_TO_ACTION behaves like JUMP_TO_STATE", () => {
  const { store, sends, simulate } = setup();
  simulate({
    type: "DISPATCH",
    state: JSON.stringify({ count: 7 }),
    payload: { type: "JUMP_TO_ACTION", index: 0 },
  });
  assertEquals(store.get(), { count: 7 });
  assertEquals(sends.length, 0);
  teardown();
});

Deno.test("devtools - RESET restores initial state", () => {
  const { store, simulate } = setup();
  store.increment(10);
  simulate({ type: "DISPATCH", state: "", payload: { type: "RESET" } });
  assertEquals(store.get(), { count: 0 });
  teardown();
});

Deno.test("devtools - RESET calls connection.init with initial state", () => {
  const { store, simulate, inits } = setup();
  store.increment(10);
  simulate({ type: "DISPATCH", state: "", payload: { type: "RESET" } });
  assertEquals(inits.at(-1), { count: 0 });
  teardown();
});

Deno.test("devtools - COMMIT advances the committed baseline", () => {
  const { store, simulate, inits } = setup();
  store.increment(5);
  simulate({ type: "DISPATCH", state: "", payload: { type: "COMMIT" } });
  assertEquals(inits.at(-1), { count: 5 });
  teardown();
});

Deno.test("devtools - ROLLBACK restores last committed state", () => {
  const { store, simulate } = setup();
  store.increment(5);
  simulate({ type: "DISPATCH", state: "", payload: { type: "COMMIT" } });
  store.increment(5); // count = 10
  simulate({ type: "DISPATCH", state: "", payload: { type: "ROLLBACK" } });
  assertEquals(store.get(), { count: 5 });
  teardown();
});

Deno.test("devtools - RESET after COMMIT goes back to initial, not committed", () => {
  const { store, simulate } = setup();
  store.increment(5);
  simulate({ type: "DISPATCH", state: "", payload: { type: "COMMIT" } });
  store.increment(5); // count = 10
  simulate({ type: "DISPATCH", state: "", payload: { type: "RESET" } });
  assertEquals(store.get(), { count: 0 });
  teardown();
});

Deno.test("devtools - IMPORT_STATE restores the current computed state", () => {
  const { store, simulate } = setup();
  simulate({
    type: "DISPATCH",
    state: "",
    payload: {
      type: "IMPORT_STATE",
      nextLiftedState: {
        computedStates: [{ state: { count: 0 } }, { state: { count: 3 } }, {
          state: { count: 7 },
        }],
        currentStateIndex: 2,
      },
    },
  });
  assertEquals(store.get(), { count: 7 });
  teardown();
});

Deno.test("devtools - unsubscribe called on store destroy", () => {
  const { store, wasUnsubscribed } = setup();
  store.destroy();
  assertEquals(wasUnsubscribed(), true);
  teardown();
});

Deno.test("devtools - no-op when extension is absent", () => {
  teardown(); // ensure extension is not set
  const store = createStore({ count: 0 })
    .use({
      increment(n: number): void {
        this.merge((s) => ({ count: s.count + n }));
      },
    })
    .use("devtools", devtools());
  store.increment(1);
  assertEquals(store.get(), { count: 1 });
});
