/**
 * Common contract every library's harness (`*.harness.tsx`) implements, plus
 * the scenario names `speed-bench.ts` drives them through. Each method mounts
 * a fresh store (independent counter fields, a derived sum, and a swappable
 * item list), performs one scenario's burst, unmounts, and returns raw
 * (single-trial) metrics; `speed-bench.ts` is what repeats a method across
 * trials and takes the median (see `runTrials` in `scenario.ts`).
 */

import {
  FIELD_COUNT,
  ITEM_COUNT,
  type Metrics,
  UPDATE_BURST_SIZE,
} from "./scenario.ts";

/** Every `SpeedHarness` method that runs a scenario: everything but the display `name`. */
export type ScenarioKey = Exclude<keyof SpeedHarness, "name">;

export interface SpeedHarness {
  /** Display name, as it should appear in printed output. */
  name: string;
  /** Scenario 1: mounts the full store (fields + derived sum + items), returns `{ wallMs }`. */
  mount(): Promise<Metrics>;
  /** Scenario 2: a burst of updates on one field. */
  updateOneField(): Promise<Metrics>;
  /** Scenario 3: a burst of updates round-robined across every field. */
  updateAllFields(): Promise<Metrics>;
  /** Scenario 4: a burst of adjacent-pair item swaps. */
  swapItems(): Promise<Metrics>;
}

export const SCENARIOS: ReadonlyArray<{ key: ScenarioKey; label: string }> = [
  {
    key: "mount",
    label: `Initial mount (${FIELD_COUNT} fields + ${ITEM_COUNT} items)`,
  },
  {
    key: "updateOneField",
    label: `Single-field update burst (${UPDATE_BURST_SIZE}x)`,
  },
  {
    key: "updateAllFields",
    label:
      `Round-robin update burst (${UPDATE_BURST_SIZE}x across ${FIELD_COUNT} fields)`,
  },
  { key: "swapItems", label: `Item swap burst (${UPDATE_BURST_SIZE}x)` },
];
