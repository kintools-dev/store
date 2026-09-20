import type { NestedMethods, StorePlugin } from "@kintools/store-core";

type BroadcastMethods = {
  /**
   * Closes the underlying `BroadcastChannel`, stopping cross-tab sync for
   * this store. Called automatically on `store.destroy()`.
   */
  close(): void;
};

/**
 * Options accepted by {@linkcode broadcast}.
 */
export type BroadcastOptions = {
  /**
   * The `BroadcastChannel` name. Only stores constructed with the same name
   * (typically in other browser tabs/windows of the same origin) sync with
   * each other.
   */
  name: string;
};

// `clock` orders messages so a reply to a stale "request" (e.g. from a tab
// that opened, asked for state, and only got a slow answer back) can never
// clobber a state this tab already knows is newer. It starts at 0 ("no
// local change yet") rather than the activation time, since a freshly
// opened tab with an untouched default state is not "newer" than a real
// change another tab already broadcast.
type Message<TState> =
  | { type: "state"; state: TState; clock: number }
  | { type: "request" };

// Centralizes the `Message<TState>` cast so call sites just pass a plain object
// literal.
function postMessage<TState>(
  channel: BroadcastChannel,
  message: Message<TState>,
): void {
  channel.postMessage(message);
}

/**
 * Creates a plugin that syncs a store's entire state across browser tabs
 * using `BroadcastChannel`.
 *
 * Unlike {@linkcode import("./persist.ts").persist persist}, this plugin
 * does not touch storage: every state change is broadcast to other tabs
 * directly, and an incoming state is applied via `store.set()`. Tabs opened
 * after others request the current state on activation, so they don't have
 * to wait for the next change to catch up.
 *
 * Conflicts are resolved last-write-wins by wall-clock time: if two tabs
 * change state within the same millisecond, one of the changes is silently
 * dropped. For state that genuinely needs conflict resolution (concurrent
 * edits merged rather than one replacing the other), broadcast the specific
 * operations instead of the whole state, or reach for a CRDT library.
 *
 * The namespace is provided automatically via `store.use(namespace, broadcast(options))`,
 * so you do not need to pass it to the plugin factory itself.
 *
 * @param options Broadcast options.
 *
 * @example Basic usage
 * ```ts
 * const store = createStore({ items: [] as string[] })
 *   .use({
 *     add(item: string): void {
 *       this.merge((s) => ({ items: [...s.items, item] }));
 *     },
 *   })
 *   .use("broadcast", broadcast({ name: "todos" }));
 *
 * store.add("hello"); // seen by other tabs sharing the "todos" channel
 * ```
 *
 * @example Combined with persist for storage plus live sync
 * ```ts
 * const store = createStore({ items: [] as string[] })
 *   .use("persist", persist({ key: "todos" }))
 *   .use("broadcast", broadcast({ name: "todos" }));
 * ```
 *
 * @template TState The store's state type.
 * @template TStoreMethods Methods already on the store before this plugin is applied.
 * @template TNamespace The namespace passed to `store.use(namespace, broadcast(...))`,
 * or `undefined` for top-level. Inferred automatically.
 */
export function broadcast<
  TState,
  TStoreMethods extends NestedMethods,
  TNamespace extends string | undefined,
>(
  options: BroadcastOptions,
): StorePlugin<TState, TStoreMethods, TNamespace, BroadcastMethods> {
  const { name } = options;

  // Assigned in onActivated, but referenced by close() through this shared
  // binding rather than by value.
  let channel: BroadcastChannel;
  let isApplying = false;
  let clock = 0;

  return {
    onActivated() {
      channel = new BroadcastChannel(name);

      channel.onmessage = (event: MessageEvent<Message<TState>>) => {
        const message = event.data;

        if (message.type === "request") {
          postMessage(channel, { type: "state", state: this.get(), clock });
          return;
        }

        // Stale reply to an old request, or a message this tab's own state
        // has already moved past: applying it would be a regression.
        if (message.clock <= clock) return;

        clock = message.clock;
        isApplying = true;
        try {
          this.set(message.state);
        } finally {
          isApplying = false;
        }
      };

      this.subscribe(() => {
        if (isApplying) return;
        // `Math.max` with `clock + 1` keeps the clock strictly increasing
        // even across multiple changes within the same millisecond, so a
        // rapid second change is never mistaken for a stale duplicate of
        // the first by a receiving tab.
        clock = Math.max(Date.now(), clock + 1);
        postMessage(channel, { type: "state", state: this.get(), clock });
      });

      // Ask any already-open tabs for their current state, in case this
      // store started after they did.
      postMessage(channel, { type: "request" });
    },

    onDestroy() {
      channel.close();
    },

    close() {
      channel.close();
    },
  };
}
