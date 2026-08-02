import { applyBoons } from '../data/boons';
import type { BoonDef, HeroDef } from '../types';

export interface BoonStack {
  boon: BoonDef;
  count: number;
}

/**
 * Persistent state of a single roguelike run: the boons picked between fights and
 * the roster they derive. Lives as long as the run — a new run means a new instance.
 * `base` is the party chosen on the selection screen; boons never mutate it.
 */
export class RunState {
  readonly boons: BoonDef[] = [];
  private defs: HeroDef[];

  constructor(private readonly base: HeroDef[]) {
    this.defs = base;
  }

  /** The party as buffed by every boon picked so far. */
  heroDefs(): HeroDef[] {
    return this.defs;
  }

  addBoon(boon: BoonDef): void {
    this.boons.push(boon);
    this.defs = applyBoons(this.base, this.boons);
  }

  /** Owned boons collapsed to unique entries, in pick order, with their stack count. */
  stacks(): BoonStack[] {
    const stacks: BoonStack[] = [];
    for (const boon of this.boons) {
      const found = stacks.find(s => s.boon.id === boon.id);
      if (found) found.count += 1;
      else stacks.push({ boon, count: 1 });
    }
    return stacks;
  }
}
