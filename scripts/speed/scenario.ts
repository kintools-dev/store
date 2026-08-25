/**
 * Shared state shape, sizing constants, and trial-running helper for the
 * speed benchmark: one source of truth so every library's harness
 * (`*.harness.tsx`) measures the exact same workload. See `speed-bench.ts`
 * for how this gets driven.
 */

export const FIELD_COUNT = 20;
export const ITEM_COUNT = 20;
export const UPDATE_BURST_SIZE = 2000;
export const TRIAL_COUNT = 15;

export interface Item {
  id: string;
  value: number;
}

export interface CounterState {
  fields: number[];
  items: Item[];
}

export function makeInitialState(): CounterState {
  return {
    fields: Array.from({ length: FIELD_COUNT }, () => 0),
    items: Array.from(
      { length: ITEM_COUNT },
      (_, i) => ({ id: `item-${i}`, value: i }),
    ),
  };
}

/** The render-counter key for field `index`. */
export function fieldKey(index: number): string {
  return `field.${index}`;
}

/** The render-counter key for item `index`. */
export function itemKey(index: number): string {
  return `item.${index}`;
}

export function allFieldKeys(): string[] {
  return Array.from({ length: FIELD_COUNT }, (_, i) => fieldKey(i));
}

export function allItemKeys(): string[] {
  return Array.from({ length: ITEM_COUNT }, (_, i) => itemKey(i));
}

/** A scenario's raw measurements: keys vary per scenario, values are always numeric. */
export type Metrics = Record<string, number>;

/**
 * Runs `runOnce` `TRIAL_COUNT + 1` times, discards the first (JIT/cache
 * warmup), and returns the per-key median across the rest, resistant to a
 * single GC-pause outlier the way a mean isn't.
 */
export async function runTrials(
  runOnce: () => Metrics | Promise<Metrics>,
): Promise<Metrics> {
  const samples: Metrics[] = [];
  for (let i = 0; i < TRIAL_COUNT + 1; i++) {
    samples.push(await runOnce());
  }
  samples.shift(); // discard warmup

  const result: Metrics = {};
  for (const key of Object.keys(samples[0])) {
    const values = samples.map((s) => s[key]).sort((a, b) => a - b);
    result[key] = values[Math.floor(values.length / 2)];
  }
  return result;
}
