---
pageClass: comparison-page
description: "A line-by-line comparison of the same todo store implemented in Kin Store, Redux/RTK, Zustand, Jotai, and MobX, with a full feature matrix and the tradeoffs named directly."
---

# Comparison

The same todo store — `{ todos, status }` with `addTodo` and `fetchTodos` —
implemented in each library. Full, working setup in every example.

## Feature matrix

<FeatureMatrix full={true} />

## vs Redux / RTK

Kin Store keeps sync and async state changes in one flat model: reducers for the
state change, methods for orchestration, both fully inferred with no manual type
exports. Redux splits that same logic across a thunk and a slice's
`extraReducers`, and needs `RootState`/`AppDispatch` exported by hand for types
to flow through call sites.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { withPlugins } from "@kintools/store-core";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Sync and async live side-by-side — reducers for state changes,
// methods for orchestration. No separate thunk concept.
const todoStore = withPlugins<TodoState>({ todos: [], status: "idle" }).use({
  reducers: {
    addTodo: (state, text: string) => ({
      ...state,
      todos: [...state.todos, { id: Date.now(), text, done: false }],
    }),
    fetchStart: (state) => ({ ...state, status: "loading" }),
    fetchFulfilled: (state, todos: Todo[]) => ({ todos, status: "idle" }),
    fetchRejected: (state) => ({ ...state, status: "failed" }),
  },
  middleware: () => (ctx, next) => {
    console.log("dispatching", ctx.reducer.name, ctx.reducer.args);
    return next();
  },
  methods: (store) => ({
    async fetchTodos(): Promise<void> {
      store.dispatch.fetchStart();
      try {
        const resp = await fetch("/api/todos");
        const todos = (await resp.json()) as Todo[];
        store.dispatch.fetchFulfilled(todos);
      } catch {
        store.dispatch.fetchRejected();
      }
    },
  }),
});

// Fully typed — no manual type exports needed.
todoStore.dispatch.addTodo("Buy groceries");
await todoStore.fetchTodos();
```

</CodeGroupItem>

<CodeGroupItem label="Redux / RTK">

```ts
import {
  configureStore,
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";
import type { Middleware, PayloadAction } from "@reduxjs/toolkit";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Async action must be defined separately from the slice that handles it.
const fetchTodos = createAsyncThunk("todos/fetch", async () => {
  const resp = await fetch("/api/todos");
  return (await resp.json()) as Todo[];
});

const todosSlice = createSlice({
  name: "todos",
  initialState: { todos: [], status: "idle" } as TodoState,
  reducers: {
    addTodo: (state, action: PayloadAction<string>) => {
      state.todos.push({ id: Date.now(), text: action.payload, done: false });
    },
  },
  // Async results are handled in a separate block from sync reducers.
  extraReducers: (builder) => {
    builder
      .addCase(fetchTodos.pending, (s) => {
        s.status = "loading";
      })
      .addCase(fetchTodos.fulfilled, (s, a) => {
        s.todos = a.payload;
        s.status = "idle";
      })
      .addCase(fetchTodos.rejected, (s) => {
        s.status = "failed";
      });
  },
});

// Middleware is a curried function — three layers of arrow functions.
const logger: Middleware = (api) => (next) => (action) => {
  console.log("dispatching", action);
  return next(action);
};

const store = configureStore({
  reducer: { todos: todosSlice.reducer },
  middleware: (m) => m().concat(logger),
});

// TypeScript requires these to be exported manually.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Actions must be accessed through the slice object, not the store.
store.dispatch(todosSlice.actions.addTodo("Buy groceries"));
store.dispatch(fetchTodos()); // Returns a thunk, not a plain action.
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                     | Kin Store                     | Redux / RTK                               |
| ------------------- | ----------------------------- | ----------------------------------------- |
| Async actions       | Method that calls reducers    | `createAsyncThunk` + `extraReducers`      |
| Middleware          | `(ctx, next) => ...`          | `(api) => (next) => (action) => ...`      |
| Type exports        | Fully inferred — zero exports | `RootState`, `AppDispatch` manual exports |
| Access pattern      | `store.dispatch.addTodo(...)` | `slice.actions.addTodo(...)`              |
| Call logic in React | Call directly — no hook       | `useDispatch()` hook required             |

Redux-Saga's `takeLatest` sequences and cancels concurrent calls to the same
action for you; Kin Store's `methods` don't, the same tradeoff Zustand makes.
See
[Guarding against race conditions](/store/guide/with-plugins#guarding-against-race-conditions)
for the manual pattern.

### Writing extensions

The fundamental difference is model: Redux enhancers (and Zustand middleware)
are imperative wrappers — functions that intercept the store factory and may
freely reshape any part of the store API. A Kin Store plugin is a declarative
object: it lists what it contributes (reducers, middleware, methods, lifecycle
hooks) and nothing more. That constraint is what makes plugins fully type-safe
without `any`, and registration safe — the runtime validates names at `.use()`
time and throws on conflict.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store plugin">

```ts
import { getPluginDispatch } from "@kintools/store-core";
import type {
  InferActions,
  NestedMethods,
  NestedReducers,
  StorePlugin,
} from "@kintools/store-core";

type HistoryReducers<TState> = {
  _restore: (state: TState, saved: TState) => TState;
};
type HistoryMethods = {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
};

// TState flows through every type position — no any needed.
export function history<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(): StorePlugin<
  TState,
  TStoreReducers,
  TStoreMethods,
  TNamespace,
  HistoryReducers<TState>,
  HistoryMethods
> {
  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  return {
    reducers: {
      // A declared reducer, not a hidden action type — visible in devtools.
      _restore: (_state, saved: TState) => saved,
    },

    methods: (store, { namespace }) => {
      const dispatch = getPluginDispatch(store, namespace);

      function restore(state: TState): void {
        isRestoring = true;
        dispatch._restore(state); // Fully typed.
        isRestoring = false;
      }

      return {
        canUndo: () => index > 0,
        canRedo: () => index + 1 < snapshots.length,
        undo(): boolean {
          if (index <= 0) return false;
          restore(snapshots[--index]);
          return true;
        },
        redo(): boolean {
          if (index + 1 >= snapshots.length) return false;
          restore(snapshots[++index]);
          return true;
        },
      };
    },

    onActivated: (store) => {
      snapshots.push(store.get());
      store.subscribe((get) => {
        if (isRestoring) return;
        snapshots.length = index + 1;
        snapshots.push(get());
        index = snapshots.length - 1;
      });
    },
  };
}
```

</CodeGroupItem>

<CodeGroupItem label="Redux enhancer">

```ts
import { configureStore } from "@reduxjs/toolkit";
import type { StoreEnhancer } from "@reduxjs/toolkit";

type HistoryExt = {
  history: {
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): boolean;
    redo(): boolean;
  };
};

// StoreEnhancer<Ext> does not thread state — TState must be manually inferred
// from the reducer. Action types still require casts to satisfy Redux's Action.
function makeHistory(): StoreEnhancer<HistoryExt> {
  return (createStoreApi) => (reducer: any, preloadedState: any) => {
    type TState = ReturnType<typeof reducer>;
    type RestoreAction = { type: "@@HISTORY/RESTORE"; payload: TState };

    const snapshots: TState[] = [];
    let index = 0;
    let isRestoring = false;

    // Wrap the reducer to intercept a private RESTORE action.
    const wrapped: typeof reducer = (state, action) =>
      // Type casts required for type safety.
      (action as unknown as RestoreAction).type === "@@HISTORY/RESTORE"
        ? (action as unknown as RestoreAction).payload
        : reducer(state, action);

    const store = createStoreApi(wrapped, preloadedState);
    snapshots.push(store.getState());

    store.subscribe(() => {
      if (isRestoring) return;
      snapshots.length = index + 1;
      snapshots.push(store.getState());
      index = snapshots.length - 1;
    });

    function restore(saved: TState): void {
      isRestoring = true;
      store.dispatch(
        // Type cast required for type safety.
        { type: "@@HISTORY/RESTORE", payload: saved } as RestoreAction as never,
      );
      isRestoring = false;
    }

    return {
      ...store,
      history: {
        canUndo: () => index > 0,
        canRedo: () => index + 1 < snapshots.length,
        undo(): boolean {
          if (index <= 0) return false;
          restore(snapshots[--index]);
          return true;
        },
        redo(): boolean {
          if (index + 1 >= snapshots.length) return false;
          restore(snapshots[++index]);
          return true;
        },
      },
    };
  };
}

const store = configureStore({
  reducer: rootReducer,
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers().concat(makeHistory()),
});

store.history.undo(); // ✓ — snapshots are TState[], but required manual inference and casts
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

<Container type="warning">

Kin Store plugins have full access to the store from `onActivated`, `onDestroy`,
and `methods` — but patching the store object itself is discouraged. Declare
capabilities through `methods` and `reducers` instead; the plugin system is
designed around those.

</Container>

## vs Zustand

Kin Store separates state from behavior by construction, and infers types
without needing an annotation to remember. Zustand keeps state and actions in
one object, so the type alone can't say what's data and what's behavior, and
infers as `any`/`unknown` if you omit the explicit type annotation on
`create<State>()` (or the innermost plugin call).

Kin Store's plugins read top-to-bottom: each `.use()` call adds one capability
without touching the ones before it. Zustand's middleware nests instead, read
right-to-left with the outer layer wrapping the inner one, so adding `persist`
and `devtools` means three levels of nesting. Each middleware can also alter the
store's own API shape: `immer` changes `setState`'s updater from
`(state: TState) => TState | Partial<TState>` to
`(state: WritableNonArrayDraft<TState>) => void`, so what `setState` accepts
depends on composition order.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { history, immer, persist } from "@kintools/store-plugins";
import { useSelector, withPlugins } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Read top-to-bottom — each .use() adds one plugin, not one nesting level.
const todoStore = withPlugins({ todos: [], status: "idle" } as TodoState)
  .use("persist", persist({ key: "todos" }))
  .use("history", history())
  .use(
    immer({
      methods: (immerStore) => ({
        addTodo(text: string): void {
          immerStore.set((draft) => {
            draft.todos.push(text);
          });
        },

        async fetchTodos(): Promise<void> {
          immerStore.set((draft) => {
            draft.status = "loading";
          });
          try {
            const resp = await fetch("/api/todos");
            const todos = (await resp.json()) as Todo[];
            immerStore.set((draft) => {
              draft.todos = todos;
              draft.status = "idle";
            });
          } catch {
            immerStore.set((draft) => {
              draft.status = "failed";
            });
          }
        },
      }),
    }),
  );

// Plugins can be namespaced — no conflicts, no configuration buried in wrappers.
await todoStore.persist.hydrate();
todoStore.history.undo();

// In React — methods are stable refs, not part of the state subscription.
function TodoApp() {
  const todos = useSelector(todoStore, (s) => s.todos);
  return <button onClick={() => todoStore.addTodo("new")}>Add</button>;
}
```

</CodeGroupItem>

<CodeGroupItem label="Zustand">

```ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type Todo = { id: number; text: string; done: boolean };

// State and actions must share one type — no structural separation.
type TodoStore = {
  todos: Todo[];
  status: "idle" | "loading" | "failed";
  addTodo: (text: string) => void;
  fetchTodos: () => Promise<void>;
};

// Read inside-out: immer → persist → devtools.
// The order matters and affects what `set` does inside each wrapper.
const useStore = create(
  devtools(
    persist(
      // Explicit type annotation required.
      immer<TodoStore>((set) => ({
        todos: [],
        status: "idle" as const,

        addTodo: (text: string) =>
          set((draft) => {
            draft.todos.push({ id: Date.now(), text, done: false });
          }),

        fetchTodos: async () => {
          set((draft) => {
            draft.status = "loading";
          });
          try {
            const resp = await fetch("/api/todos");
            const todos = (await resp.json()) as Todo[];
            set((draft) => {
              draft.todos = todos;
              draft.status = "idle";
            });
          } catch {
            set((draft) => {
              draft.status = "failed";
            });
          }
        },
      })),
      { name: "todos-storage" }, // persist config
    ),
    { name: "TodoStore" }, // devtools config
  ),
);

// In React — subscribing to addTodo registers a watcher that fires on every
// state change, even though addTodo is a stable ref that never changes.
function TodoApp() {
  const todos = useStore((s) => s.todos);
  const addTodo = useStore((s) => s.addTodo); // unnecessary subscription.
}
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                        | Kin Store                                                        | Zustand                                                                    |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Extension/Plugin model | Declarative object — declares reducers, methods, lifecycle hooks | Imperative wrapper — each layer may alter `set`, `get`, or the store shape |
| Adding persist         | `.use('persist', persist(...))`                                  | Wrap entire store in `persist(...)`                                        |
| Adding immer           | `.use('immer', immer())`                                         | Wrap again in `immer(...)`                                                 |
| Adding devtools        | `.use('devtools', devtools(...))`                                | Wrap again in `devtools(...)`                                              |
| Reading pipeline order | Top-to-bottom                                                    | Inside-out                                                                 |
| State vs actions       | Structurally separate                                            | Same object                                                                |
| Call logic in React    | Call directly — no hook                                          | Hook required — subscribes even to stable action refs                      |

### Writing extensions

A Kin Store plugin is a declarative object, so writing one means listing what it
contributes (reducers, middleware, methods, lifecycle hooks) with no runtime
patching involved. Every Zustand middleware instead implements the
`StateCreator` protocol directly: receive `(fn, set, get, api)`, patch `api` to
add new behavior, then call `fn(set, get, api)` and return its result. An
undo/redo middleware built this way needs the full ceremony: a `declare
module`
augmentation for the types, the `history` namespace added by mutating
`api as any`, and the whole thing cast via `as unknown as History` because the
type system can't follow the runtime mutation, the same pattern every official
Zustand middleware uses.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store plugin">

```ts
import { getPluginDispatch } from "@kintools/store-core";
import type {
  InferActions,
  NestedMethods,
  NestedReducers,
  StorePlugin,
} from "@kintools/store-core";

type HistoryReducers<TState> = {
  _restore: (state: TState, saved: TState) => TState;
};

type HistoryMethods = {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
};

// TState flows through every type position — no any needed.
export function history<
  TState,
  TStoreReducers extends NestedReducers<TState>,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(): StorePlugin<
  TState,
  TStoreReducers,
  TStoreMethods,
  TNamespace,
  HistoryReducers<TState>,
  HistoryMethods
> {
  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  return {
    reducers: {
      // A declared reducer — visible in devtools.
      _restore: (_state, saved) => saved,
    },

    methods: (store, { namespace }) => {
      const dispatch = getPluginDispatch(store, namespace);

      function restore(state: TState): void {
        isRestoring = true;
        dispatch._restore(state);
        isRestoring = false;
      }

      return {
        canUndo: () => index > 0,
        canRedo: () => index + 1 < snapshots.length,
        undo(): boolean {
          if (index <= 0) return false;
          restore(snapshots[--index]);
          return true;
        },
        redo(): boolean {
          if (index + 1 >= snapshots.length) return false;
          restore(snapshots[++index]);
          return true;
        },
      };
    },

    onActivated: (store) => {
      snapshots.push(store.get());
      store.subscribe((get) => {
        if (isRestoring) return;
        snapshots.length = index + 1;
        snapshots.push(get());
        index = snapshots.length - 1;
      });
    },
  };
}
```

</CodeGroupItem>

<CodeGroupItem label="Zustand middleware">

```ts
import { StateCreator, StoreMutatorIdentifier } from "zustand";

type Write<T, U> = Omit<T, keyof U> & U;

type HistoryApi = {
  history: {
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): boolean;
    redo(): boolean;
  };
};

// Module augmentation required to extend the store's TypeScript type.
declare module "zustand/vanilla" {
  interface StoreMutators<S, A> {
    "custom/history": Write<S, HistoryApi>;
  }
}

type History = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  fn: StateCreator<T, [...Mps, ["custom/history", never]], Mcs>,
) => StateCreator<T, Mps, [["custom/history", never], ...Mcs]>;

type HistoryImpl = <T>(
  fn: StateCreator<T, [], []>,
) => StateCreator<T, [], []>;

// A higher-order function that wraps the original state creator and alters the
// store API.
const historyImpl: HistoryImpl = (fn) => (set, get, api) => {
  // Manual type inference required because the type system can't follow the
  // runtime mutation.
  type TState = ReturnType<typeof get>;

  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  function restore(state: TState): void {
    isRestoring = true;
    api.setState(state, true);
    isRestoring = false;
  }

  // Add history namespace by mutating api directly — silent override.
  (api as typeof api & HistoryApi).history = {
    canUndo: () => index > 0,
    canRedo: () => index + 1 < snapshots.length,
    undo(): boolean {
      if (index <= 0) return false;
      restore(snapshots[--index]);
      return true;
    },
    redo(): boolean {
      if (index + 1 >= snapshots.length) return false;
      restore(snapshots[++index]);
      return true;
    },
  };

  const state = fn(set, get, api);

  snapshots.push(api.getState());

  api.subscribe((current) => {
    if (isRestoring) return;
    snapshots.length = index + 1;
    snapshots.push(current);
    index = snapshots.length - 1;
  });

  return state;
};

// Type system can't follow the runtime mutation — double cast required.
export const history = historyImpl as unknown as History;
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                | Kin Store plugin                   | Zustand middleware                                      |
| -------------- | ---------------------------------- | ------------------------------------------------------- |
| Type extension | `StorePlugin` generics             | `declare module` augmentation + `as unknown as History` |
| Expose methods | `methods` on a plain object        | Mutate `api as any`                                     |
| Restore state  | `_restore` reducer — full pipeline | `api.setState(saved, true)` — bypasses all middlewares  |
| Name collision | Throws at registration time        | Silent overwrite                                        |

<Container type="warning">

Kin Store plugins have full access to the store from `onActivated`, `onDestroy`,
and `methods` — but patching the store object itself is discouraged. Declare
capabilities through `methods` and `reducers` instead; the plugin system is
designed around those.

</Container>

## vs Jotai

Jotai is atom-based — each piece of state is its own atom, and derived atoms
compose them. It's a different model rather than a worse one, but it means
thinking in atoms rather than in domains. App logic must also be wrapped in
atoms — `atom(null, (get, set, arg) => ...)` — there is no plain function style.

Both reading (`useAtomValue`) and writing (`useSetAtom`) are hook-bound inside
React. Outside React, `jotai/vanilla` or `getDefaultStore()` provides a
`{ get, set, sub }` interface — but it is a separate path, not how you write
most Jotai code.

When a write atom throws, the stack trace surfaces at the `useSetAtom` call site
in your component, not at the atom definition. A chain of atoms triggering other
atoms can be hard to follow in a debugger.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { createStore, useStore } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };

// One store per field.
const todosStore = createStore<Todo[]>([]);
const statusStore = createStore<"idle" | "loading" | "failed">("idle");

// App logic can just be top-level functions.
function addTodo(text: string): void {
  todosStore.set((prev) => [...prev, { id: Date.now(), text, done: false }]);
}

async function fetchTodos(): Promise<void> {
  statusStore.set("loading");
  try {
    const todos = (await fetch("/api/todos").then((r) => r.json())) as Todo[];
    todosStore.set(todos);
    statusStore.set("idle");
  } catch {
    statusStore.set("failed");
  }
}

function TodoApp() {
  const todos = useStore(todosStore);
  const status = useStore(statusStore);

  // addTodo and fetchTodos can be accessed directly anywhere.
  // No hooks required.

  // ...
}
```

</CodeGroupItem>

<CodeGroupItem label="Jotai">

```ts
import { atom, useAtomValue, useSetAtom } from "jotai";

type Todo = { id: number; text: string; done: boolean };

// Each field is its own atom.
const todosAtom = atom<Todo[]>([]);
const statusAtom = atom<"idle" | "loading" | "failed">("idle");

// App logic must be wrapped in an atom.
const addTodoAtom = atom(null, (get, set, text: string) => {
  set(todosAtom, (prev) => [...prev, { id: Date.now(), text, done: false }]);
});

const fetchTodosAtom = atom(null, async (get, set) => {
  set(statusAtom, "loading");
  try {
    const todos = (await fetch("/api/todos").then((r) => r.json())) as Todo[];
    set(todosAtom, todos);
    set(statusAtom, "idle");
  } catch {
    set(statusAtom, "failed");
  }
});

function TodoApp() {
  const todos = useAtomValue(todosAtom);
  const status = useAtomValue(statusAtom);

  // Hooks required to access logic.
  const addTodo = useSetAtom(addTodoAtom);
  const fetchTodos = useSetAtom(fetchTodosAtom);

  // ...
}
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                            | Kin Store                                            | Jotai                                  |
| -------------------------- | ---------------------------------------------------- | -------------------------------------- |
| State model                | Stores (value + subscribers)                         | Atoms                                  |
| App logic                  | Plain functions / methods                            | Wrapped in atoms                       |
| Read / write outside React | Yes — `get()`, `set()` and plain functions / methods | `jotai/vanilla` or `getDefaultStore()` |
| Reactive composition       | `derive((get) => ...)`                               | Derived atoms                          |
| Mental model               | "think in domains"                                   | "think in atoms"                       |

## vs MobX

Kin Store's reactivity is explicit: state changes only through `set` or a
dispatched reducer, and a component only re-renders because it called
`useStore`/`useSelector` itself. MobX takes the opposite approach:
`makeAutoObservable` silently instruments every property and method on a class
into observables, computeds, and actions, so mutations just work with no
subscription code to write. That implicitness costs in two places: async methods
need `runInAction` to keep the reactive graph consistent, and every React
component reading observable state needs `observer()`, and forgetting either one
fails silently, stale data with no error, rather than throwing. At 15.6 KB
gzipped, it's also one of the heaviest libraries in this comparison, behind only
Redux/RTK.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { useSelector, withPlugins } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Plain object — no class, no proxy, no instrumentation.
const todoStore = withPlugins<TodoState>({ todos: [], status: "idle" })
  .use({
    methods: (store) => ({
      addTodo(text: string): void {
        store.set((s) => ({
          ...s,
          todos: [...s.todos, { id: Date.now(), text, done: false }],
        }));
      },
      async fetchTodos(): Promise<void> {
        store.set((s) => ({ ...s, status: "loading" }));
        try {
          const resp = await fetch("/api/todos");
          const todos = (await resp.json()) as Todo[];
          // set is always safe after await.
          store.set({ todos, status: "idle" });
        } catch {
          store.set((s) => ({ ...s, status: "failed" }));
        }
      },
    }),
  });

// No observer() wrapper — subscriptions are opt-in and explicit.
function TodoApp() {
  const todos = useSelector(todoStore, (s) => s.todos);
  return (
    <button onClick={() => todoStore.addTodo("Buy groceries")}>
      Add
    </button>
  );
}
```

</CodeGroupItem>

<CodeGroupItem label="MobX">

```ts
import { makeAutoObservable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";

type Todo = { id: number; text: string; done: boolean };

class TodoStore {
  todos: Todo[] = [];
  status: "idle" | "loading" | "failed" = "idle";

  constructor() {
    // Instruments every field and method — no explicit list of what is reactive.
    makeAutoObservable(this);
  }

  addTodo(text: string) {
    this.todos.push({ id: Date.now(), text, done: false });
  }

  async fetchTodos() {
    this.status = "loading";
    try {
      const resp = await fetch("/api/todos");
      const todos = (await resp.json()) as Todo[];
      // Mutations after an await must be wrapped in runInAction.
      // Forgetting this causes silent stale-data bugs — no error, wrong UI.
      runInAction(() => {
        this.todos = todos;
        this.status = "idle";
      });
    } catch {
      runInAction(() => {
        this.status = "failed";
      });
    }
  }
}

export const todoStore = new TodoStore();

// Every component that reads observable state must be wrapped in observer().
// Forgetting observer() also causes silent stale-data bugs — no error thrown.
const TodoApp = observer(() => {
  const { todos, status } = todoStore;
  return (
    <button onClick={() => todoStore.addTodo("Buy groceries")}>Add</button>
  );
});
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                        | Kin Store                        | MobX                                    |
| ---------------------- | -------------------------------- | --------------------------------------- |
| State mutations        | `set` — no proxy                 | Mutable (proxy-intercepted)             |
| Async updates          | `set` after `await` — no wrapper | Must wrap in `runInAction`              |
| Call logic in React    | Direct — no hook needed          | Direct — no hook needed                 |
| Read state in React    | `useSelector` only where needed  | `observer()` on every component         |
| Class required         | No — plain object                | Yes (or `observable({...})`)            |
| Reactive graph         | Explicit via `derive`            | Implicit, auto-tracked                  |
| Silent stale-data bugs | None                             | Two sources (`runInAction`, `observer`) |
