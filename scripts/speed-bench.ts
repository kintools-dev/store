/**
 * Measures render-count and wall-clock overhead for @kintools/store-react
 * against Zustand, Redux Toolkit, Jotai, and MobX, all mounted into a real
 * (Happy DOM) React tree via @testing-library/react, using one shared state
 * shape and update plan (see `speed/scenario.ts`) so every library does the
 * exact same work. Kin Store appears twice: once on the plain `createStore`
 * tier (`store.set(updater)`, comparable to Zustand/Jotai/MobX's own
 * direct-mutation APIs) and once on the `withPlugins`/`dispatch` tier
 * (comparable to Redux's dispatch/reducer shape) — see
 * `speed/kin-store.harness.tsx` and `speed/kin-store-dispatch.harness.tsx`.
 * Run from the repo root:
 *
 *   deno task --cwd scripts speed-bench
 *
 * (`scripts/` keeps its own deno.json rather than being a workspace member
 * proper — see `bundle-size.ts`'s module comment for why.)
 *
 * Every number here is Happy DOM (JS-only, no layout/paint), a proxy for
 * each library's own state-management overhead, not a browser-realistic
 * timing. This isn't published anywhere (no docs/README page quotes it) — it
 * exists purely to get a rough sense of how @kintools/store-react's overhead
 * compares to the libraries in the comparison page. Numbers will shift as
 * dependencies update; reproduce locally before drawing conclusions from
 * them.
 *
 * @module
 */

/// <reference lib="dom" />
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
// deno-lint-ignore no-explicit-any
(globalThis as any).document = window.document;
// deno-lint-ignore no-explicit-any
(globalThis as any).window = window;
// deno-lint-ignore no-explicit-any
(globalThis as any).navigator = window.navigator;

import { kinStoreHarness } from "./speed/kin-store.harness.tsx";
import { kinStoreDispatchHarness } from "./speed/kin-store-dispatch.harness.tsx";
import { zustandHarness } from "./speed/zustand.harness.tsx";
import { reduxHarness } from "./speed/redux.harness.tsx";
import { jotaiHarness } from "./speed/jotai.harness.tsx";
import { mobxHarness } from "./speed/mobx.harness.tsx";
import { SCENARIOS, type SpeedHarness } from "./speed/harness.ts";
import {
  type Metrics,
  runTrials,
  TRIAL_COUNT,
  UPDATE_BURST_SIZE,
} from "./speed/scenario.ts";

const harnesses: SpeedHarness[] = [
  kinStoreHarness,
  kinStoreDispatchHarness,
  zustandHarness,
  reduxHarness,
  jotaiHarness,
  mobxHarness,
];

function formatValue(key: string, value: number | undefined): string {
  if (value === undefined) return "n/a";
  if (key === "wallMs") return `${value.toFixed(2)} ms`;
  return String(Math.round(value));
}

function metricLabel(key: string): string {
  switch (key) {
    case "wallMs":
      return "wall-clock";
    case "updatedRenders":
      return "updated field renders";
    case "siblingRenders":
      return "untouched sibling renders";
    case "sumRenders":
      return "derived sum renders";
    case "totalFieldRenders":
      return "total field renders";
    case "itemRenders":
      return "array item renders (aggregate)";
    default:
      return key;
  }
}

console.log(
  `\nKin Store speed benchmark: ${TRIAL_COUNT} trials/scenario (median), ${UPDATE_BURST_SIZE}x update bursts, Happy DOM.\n`,
);

for (const scenario of SCENARIOS) {
  console.log(`## ${scenario.label}\n`);

  const results: Array<{ name: string; metrics: Metrics }> = [];
  for (const harness of harnesses) {
    const metrics = await runTrials(() =>
      harness[scenario.key]() as Promise<Metrics>
    );
    results.push({ name: harness.name, metrics });
  }

  const keys = Array.from(
    new Set(results.flatMap((r) => Object.keys(r.metrics))),
  );
  // `wallMs` always leads; the rest keep the order the first harness that has them reports them.
  keys.sort((a, b) => (a === "wallMs" ? -1 : b === "wallMs" ? 1 : 0));

  const nameWidth = Math.max(...results.map((r) => r.name.length));
  const colWidths = keys.map((key) =>
    Math.max(
      metricLabel(key).length,
      ...results.map((r) => formatValue(key, r.metrics[key]).length),
    )
  );

  console.log(
    "  " + "".padEnd(nameWidth) + "  " +
      keys.map((key, i) => metricLabel(key).padStart(colWidths[i])).join("  "),
  );
  for (const r of results) {
    console.log(
      "  " + r.name.padEnd(nameWidth) + "  " +
        keys.map((key, i) =>
          formatValue(key, r.metrics[key]).padStart(colWidths[i])
        ).join("  "),
    );
  }
  console.log();
}
