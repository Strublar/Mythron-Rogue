// Percent math shared by boons (permanent, baked into HeroDef) and buffs (temporary,
// applied at tick time). One formula, two callers — keep them in sync here.

export function grow(v: number, pct: number): number;
export function grow(v: number | undefined, pct: number): number | undefined;
export function grow(v: number | undefined, pct: number): number | undefined {
  return v === undefined ? undefined : Math.round(v * (1 + pct / 100));
}

/** Haste: a percent bonus shortens the interval instead of lengthening it. */
export function haste(ms: number, pct: number): number {
  return Math.round(ms / (1 + pct / 100));
}
