---
description: "Two recipes for syncing store state across open tabs: the storage event with persist, or BroadcastChannel directly with no persistence involved."
---

# Cross-Tab Sync

`persist` writes on every change, store → storage, but nothing pulls the other
direction. Open the same app in two tabs, edit the store in one, and the other
tab's live state doesn't know anything changed until it's reloaded. This recipe
closes that gap: no new plugin, just `store.persist.hydrate()` called in
response to a cross-tab signal.

## Using the storage event

For the common case, `persist` backed by `localStorage`, the browser already
tells other tabs when a key changes. The `storage` event fires only in tabs that
_didn't_ make the write, so there's no risk of a tab reacting to its own change:

```ts
import { withPlugins } from "@kintools/store-core";
import { persist } from "@kintools/store-plugins";

const KEY = "todos";

const store = withPlugins({ items: [] as string[] })
  .use("persist", persist({ key: KEY }))
  .use({
    reducers: {
      addTodo: (s, text: string) => ({ items: [...s.items, text] }),
    },
  });

window.addEventListener("storage", (event) => {
  if (event.key === KEY) {
    store.persist.hydrate();
  }
});
```

Filtering on `event.key` matters: `storage` fires for _any_ key changing on the
origin, not just this store's.

## Using BroadcastChannel

The `storage` event only fires for real `localStorage`/`sessionStorage` writes.
If `persist` is configured with a custom `storage` backend (an IndexedDB
wrapper, say), it won't fire at all. `BroadcastChannel` works regardless of the
backend, since the tab announces the change itself instead of relying on the
browser to notice a storage write:

```ts
const channel = new BroadcastChannel("todos-sync");

store.subscribe(() => channel.postMessage("changed"));

channel.addEventListener("message", () => {
  store.persist.hydrate();
});
```

A `BroadcastChannel` object never receives its own posted messages, the same
origin-tab exclusion the `storage` event has, so this needs no reentrancy guard
either: `postMessage` here only ever reaches _other_ tabs' channels.

<Container type="warning">

Both approaches only reach tabs that are already open when the message is sent.
A tab opened later still starts with the correct value, because that comes from
`persist`'s normal hydration on startup, not from a signal it never saw.

</Container>

## Without persist

Both recipes above lean on `persist`: state round-trips through storage, and the
browser (or the tab itself) just signals "go read it again." A store that
doesn't use `persist` at all has no storage to re-read, but its state can be
broadcast directly instead, the way jotai's `atomWithBroadcast` does it: post
the new state on every change, and apply whatever arrives.

That's exactly what the [`broadcast`](/store/plugins/broadcast) plugin does:

```ts
import { withPlugins } from "@kintools/store-core";
import { broadcast } from "@kintools/store-plugins";

const store = withPlugins({ items: [] as string[] })
  .use({
    reducers: {
      addTodo: (s, text: string) => ({ items: [...s.items, text] }),
    },
  })
  .use("broadcast", broadcast({ name: "todos" }));

store.dispatch.addTodo("hello"); // seen by other tabs sharing the "todos" channel
```

It's worth reaching for the plugin instead of hand-rolling this one: unlike the
`storage`/`persist.hydrate()` recipes above, a message here carries the _state
itself_, not just a change signal, and `BroadcastChannel` delivers it through
the structured clone algorithm, a fresh object on every hop. That breaks the
reentrancy trick the other two recipes rely on (`store.set` only notifies when
the new state differs by `Object.is`, but a cloned object is never `===` the
original), so applying an incoming message the naive way re-notifies, which
re-broadcasts, which the other tab re-applies, forever. `broadcast` guards
against this with an explicit re-entrancy flag instead, and tags each message
with a clock so a slow reply to an old "what's the current state?" request can't
clobber a newer change that already arrived by a faster path. See the plugin's
docs for the full behavior, including its request/response handshake for tabs
opened after others.
