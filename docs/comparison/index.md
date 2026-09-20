---
pageClass: comparison-page
description: "A line-by-line comparison of one todo store built in Kin Store, Redux/RTK, Zustand, Jotai, and MobX, with a feature matrix and named tradeoffs."
---

# Comparison

The same todo store in each library, trimmed to what each section compares.

## Feature matrix

<FeatureMatrix full={true} />

## vs Zustand

Kin Store keeps state and behavior structurally separate and infers types
without an annotation. Zustand keeps both in one object, so the type can't say
which is data and which is behavior, and it infers `any`/`unknown` if the
annotation on `create<State>()` (or the innermost middleware call) is missing.

Kin Store's plugins read top-to-bottom, one `.use()` per capability. Zustand's
middleware nests and reads inside-out, so `persist`, `devtools`, and `immer`
together are three levels deep. Each middleware can also change the store's API
shape (`immer` changes what `setState` accepts), so composition order matters.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { history, immer, persist } from "@kintools/store-plugins";
import { createStore, useSelector } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Read top-to-bottom: one .use() per plugin, no nesting.
const todoStore = createStore({ todos: [], status: "idle" } as TodoState)
  .use("persist", persist({ key: "todos" }))
  .use("history", history())
  .use(
    immer({
      addTodo(text: string): void {
        this.set((draft) => {
          draft.todos.push({ id: Date.now(), text, done: false });
        });
      },
    }),
  );

// Namespaced plugins never collide.
await todoStore.persist.hydrate();
todoStore.history.undo();

// Methods are stable refs, not part of the state subscription.
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

// State and actions share one type, no structural separation.
type TodoStore = {
  todos: Todo[];
  status: "idle" | "loading" | "failed";
  addTodo: (text: string) => void;
};

// Read inside-out: immer, persist, devtools. Order affects what `set` does
// inside each wrapper.
const useStore = create(
  devtools(
    persist(
      // The explicit type annotation is required.
      immer<TodoStore>((set) => ({
        todos: [],
        status: "idle" as const,
        addTodo: (text: string) =>
          set((draft) => {
            draft.todos.push({ id: Date.now(), text, done: false });
          }),
      })),
      { name: "todos-storage" },
    ),
    { name: "TodoStore" },
  ),
);

// Subscribing to addTodo runs its selector on every state change, even though
// the action is a stable ref.
function TodoApp() {
  const todos = useStore((s) => s.todos);
  const addTodo = useStore((s) => s.addTodo); // Unnecessary subscription.
}
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                     | Kin Store                                    | Zustand                                                        |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Extension model     | declarative object: methods, lifecycle hooks | imperative wrapper: may alter `set`, `get`, or the store shape |
| Adding a plugin     | `.use(...)`                                  | wrap the whole store again                                     |
| Reading order       | top-to-bottom                                | inside-out                                                     |
| State vs actions    | structurally separate                        | same object                                                    |
| Call logic in React | call directly, no hook                       | hook required, subscribes even to stable action refs           |

### Writing extensions

A Kin Store plugin is a declarative object: the methods and lifecycle hooks it
contributes, with no runtime patching.

A Zustand middleware implements `StateCreator` directly: receive
`(fn, set, get, api)`, patch `api`, then call `fn(set, get, api)`. An undo/redo
middleware therefore needs a `declare module` augmentation, a mutation of
`api as any`, and an `as unknown as History` cast, since the types can't follow
the runtime mutation.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store plugin">

```ts
import type { NestedMethods, StorePlugin } from "@kintools/store-core";

type HistoryMethods = {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
};

// TState flows through every type position, no `any`.
export function history<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(): StorePlugin<TState, TStoreMethods, TNamespace, HistoryMethods> {
  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  return {
    onActivated() {
      snapshots.push(this.get());
      this.subscribe(() => {
        if (isRestoring) return;
        snapshots.length = index + 1;
        snapshots.push(this.get());
        index = snapshots.length - 1;
      });
    },

    canUndo: () => index > 0,
    canRedo: () => index + 1 < snapshots.length,
    undo(): boolean {
      if (index <= 0) return false;
      isRestoring = true;
      this.set(snapshots[--index]);
      isRestoring = false;
      return true;
    },
    redo(): boolean {
      if (index + 1 >= snapshots.length) return false;
      isRestoring = true;
      this.set(snapshots[++index]);
      isRestoring = false;
      return true;
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

// Module augmentation is required to extend the store's type.
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

// Wraps the original state creator and alters the store API.
const historyImpl: HistoryImpl = (fn) => (set, get, api) => {
  // Types can't follow the runtime mutation, so TState is inferred by hand.
  type TState = ReturnType<typeof get>;

  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  // Mutates `api` directly, silently overriding anything already on `history`.
  (api as typeof api & HistoryApi).history = {
    canUndo: () => index > 0,
    canRedo: () => index + 1 < snapshots.length,
    undo(): boolean {
      if (index <= 0) return false;
      isRestoring = true;
      api.setState(snapshots[--index], true);
      isRestoring = false;
      return true;
    },
    redo(): boolean {
      if (index + 1 >= snapshots.length) return false;
      isRestoring = true;
      api.setState(snapshots[++index], true);
      isRestoring = false;
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

// Double cast required, for the same reason.
export const history = historyImpl as unknown as History;
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                | Kin Store plugin                              | Zustand middleware                                      |
| -------------- | --------------------------------------------- | ------------------------------------------------------- |
| Type extension | `StorePlugin` generics                        | `declare module` augmentation + `as unknown as History` |
| Expose methods | named methods on a plain object               | mutate `api as any`                                     |
| Restore state  | `this.set()`, runs through every listener     | `api.setState(saved, true)`, bypasses all middlewares   |
| Name collision | throws at registration time                   | silent overwrite                                        |

<Container type="warning">

Plugins can reach the whole store through `this`, but patching the store object
itself is discouraged. Declare capabilities as named methods instead.

</Container>

## vs Redux / RTK

Kin Store keeps sync and async state changes in one flat model: methods, fully
inferred, with no manual type exports. Redux splits the same logic across a
thunk and a slice's `extraReducers`, and needs `RootState` / `AppDispatch`
exported by hand for types to flow through call sites.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { createStore } from "@kintools/store-core";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// Methods are fully inferred. Each one makes a single change, like a reducer.
const todoStore = createStore<TodoState>({ todos: [], status: "idle" }).use({
  addTodo(text: string): void {
    this.merge((state) => ({
      todos: [...state.todos, { id: Date.now(), text, done: false }],
    }));
  },
  fetchStarted(): void {
    this.merge({ status: "loading" });
  },
  fetchSucceeded(todos: Todo[]): void {
    this.set({ todos, status: "idle" });
  },
  fetchFailed(): void {
    this.merge({ status: "failed" });
  },

  // Orchestrates only, no direct set/merge.
  async fetchTodos(): Promise<void> {
    this.fetchStarted();
    try {
      const resp = await fetch("/api/todos");
      this.fetchSucceeded((await resp.json()) as Todo[]);
    } catch {
      this.fetchFailed();
    }
  },
});

todoStore.addTodo("Buy milk");
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

// The async action is defined apart from the slice that handles it.
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
  // Async results are handled apart from the sync reducers.
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

// Middleware is curried: three layers of arrow functions.
const logger: Middleware = (api) => (next) => (action) => {
  console.log("dispatching", action);
  return next(action);
};

const store = configureStore({
  reducer: { todos: todosSlice.reducer },
  middleware: (m) => m().concat(logger),
});

// These types must be exported by hand.
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Actions live on the slice, not the store.
store.dispatch(todosSlice.actions.addTodo("Buy milk"));
store.dispatch(fetchTodos()); // A thunk, not a plain action.
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                     | Kin Store                         | Redux / RTK                               |
| ------------------- | --------------------------------- | ----------------------------------------- |
| Async actions       | methods that call `set`/`merge`   | `createAsyncThunk` + `extraReducers`      |
| Type exports        | fully inferred, zero exports      | `RootState`, `AppDispatch` manual exports |
| Access pattern      | `store.addTodo(...)`              | `slice.actions.addTodo(...)`              |
| Call logic in React | call directly, no hook            | `useDispatch()` hook required             |

Kin Store methods don't cancel superseded concurrent calls (Zustand's don't
either), unlike Redux-Saga's `takeLatest`; see
[Guarding against race conditions](/store/guide/with-plugins#guarding-against-race-conditions)
for the manual pattern.

### Writing extensions

A Kin Store plugin only lists the methods and hooks it contributes, which is
what keeps it type-safe without `any` and lets `.use()` throw on a name
conflict. Redux enhancers, like Zustand middleware, are imperative wrappers
around the store factory that can reshape any part of the store API.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store plugin">

```ts
import type { NestedMethods, StorePlugin } from "@kintools/store-core";

type HistoryMethods = {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
};

// TState flows through every type position, no `any`.
export function history<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(): StorePlugin<TState, TStoreMethods, TNamespace, HistoryMethods> {
  const snapshots: TState[] = [];
  let index = 0;
  let isRestoring = false;

  return {
    onActivated() {
      snapshots.push(this.get());
      this.subscribe(() => {
        if (isRestoring) return;
        snapshots.length = index + 1;
        snapshots.push(this.get());
        index = snapshots.length - 1;
      });
    },

    canUndo: () => index > 0,
    canRedo: () => index + 1 < snapshots.length,
    undo(): boolean {
      if (index <= 0) return false;
      isRestoring = true;
      this.set(snapshots[--index]);
      isRestoring = false;
      return true;
    },
    redo(): boolean {
      if (index + 1 >= snapshots.length) return false;
      isRestoring = true;
      this.set(snapshots[++index]);
      isRestoring = false;
      return true;
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

// StoreEnhancer<Ext> does not thread state: TState is inferred from the
// reducer by hand, and actions need casts to satisfy Redux's Action.
function makeHistory(): StoreEnhancer<HistoryExt> {
  return (createStoreApi) => (reducer, preloadedState) => {
    type TState = ReturnType<typeof reducer>;
    type RestoreAction = { type: "@@HISTORY/RESTORE"; payload: TState };

    const snapshots: TState[] = [];
    let index = 0;
    let isRestoring = false;

    // Wraps the reducer to intercept a private RESTORE action.
    const wrapped: typeof reducer = (state, action) =>
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

store.history.undo();
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

## vs Jotai

Kin Store's stores hold a value and its subscribers, and app logic is plain
functions or methods. Jotai is atom-based: each piece of state is its own atom,
and derived atoms compose them. That's a different model, not a worse one, but
it means thinking in atoms rather than domains, and app logic has to be wrapped
in an atom (`atom(null, (get, set, arg) => ...)`).

Kin Store stores can be read and written anywhere with `get()` and `set()`;
`useStore` is only for components that should re-render. Jotai's reading
(`useAtomValue`) and writing (`useSetAtom`) are both hook-bound in React.
Outside React, `jotai/vanilla` or `getDefaultStore()` gives a
`{ get, set, sub }` interface, but it's a separate path. When a write atom
throws, the stack trace points at the `useSetAtom` call site rather than the
atom definition, so a chain of atoms is hard to follow in a debugger.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { createStore, useStore } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };

// One store per field.
const todosStore = createStore<Todo[]>([]);
const statusStore = createStore<"idle" | "loading" | "failed">("idle");

// App logic can be plain top-level functions.
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

  // addTodo and fetchTodos are callable directly, no hooks.

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

  // Hooks are required to reach the logic.
  const addTodo = useSetAtom(addTodoAtom);
  const fetchTodos = useSetAtom(fetchTodosAtom);

  // ...
}
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                            | Kin Store                                 | Jotai                                  |
| -------------------------- | ----------------------------------------- | -------------------------------------- |
| State model                | stores (value + subscribers)              | atoms                                  |
| App logic                  | plain functions / methods                 | wrapped in atoms                       |
| Read / write outside React | yes: `get()`, `set()` and plain functions | `jotai/vanilla` or `getDefaultStore()` |
| Reactive composition       | `derive((get) => ...)`                    | derived atoms                          |

## vs MobX

Kin Store's reactivity is explicit: state changes only through `set`, `merge`,
or a method calling one of them, and a component re-renders only because it
called `useStore`/`useSelector` itself. MobX's `makeAutoObservable` instruments
every property and method implicitly, so mutations just work, at a cost: async
methods need `runInAction`, and every component reading observable state needs
`observer()`. Forgetting either fails silently (stale data, no error). At 15.6
KB gzipped, MobX is also one of the heaviest libraries here, behind only
Redux/RTK.

<SideBySide>

<CodeGroup>

<CodeGroupItem label="Kin Store">

```ts
import { createStore, useSelector } from "@kintools/store-react";

type Todo = { id: number; text: string; done: boolean };
type TodoState = { todos: Todo[]; status: "idle" | "loading" | "failed" };

// A plain object: no class, no proxy, no instrumentation.
const todoStore = createStore<TodoState>({ todos: [], status: "idle" })
  .use({
    addTodo(text: string): void {
      this.merge((s) => ({
        todos: [...s.todos, { id: Date.now(), text, done: false }],
      }));
    },
    async fetchTodos(): Promise<void> {
      this.merge({ status: "loading" });
      try {
        const resp = await fetch("/api/todos");
        const todos = (await resp.json()) as Todo[];
        // set is always safe after await.
        this.set({ todos, status: "idle" });
      } catch {
        this.merge({ status: "failed" });
      }
    },
  });

// No observer() wrapper: subscriptions are opt-in and explicit.
function TodoApp() {
  const todos = useSelector(todoStore, (s) => s.todos);
  return <button onClick={() => todoStore.addTodo("Buy milk")}>Add</button>;
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
    // Instruments every field and method, with no list of what is reactive.
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
      // Mutations after an await need runInAction. Forgetting it fails
      // silently: no error, stale UI.
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

// Every component reading observable state needs observer(), or it silently
// goes stale.
const TodoApp = observer(() => {
  const { todos, status } = todoStore;
  return <button onClick={() => todoStore.addTodo("Buy milk")}>Add</button>;
});
```

</CodeGroupItem>

</CodeGroup>

</SideBySide>

**What's different:**

|                     | Kin Store                                   | MobX                            |
| ------------------- | ------------------------------------------- | ------------------------------- |
| State mutations     | `set`/`merge`, no proxy                     | mutable (proxy-intercepted)     |
| Async updates       | `set`/`merge` after `await`, no wrapper     | must wrap in `runInAction`      |
| Read state in React | `useStore`, `useSelector` only where needed | `observer()` on every component |
| Class required      | no, plain object                            | yes (or `observable({...})`)    |
| Reactive graph      | explicit via `derive`                       | implicit, auto-tracked          |
