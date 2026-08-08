import { ROSTER } from '../data/heroes';
import { PASSIVE_LEVEL, STARTING_PROGRESS, addExp, applyProgress, runExp } from '../data/progression';
import type { HeroDef, HeroProgress } from '../types';

const STORAGE_KEY = 'mythron.progression.v1';

type ProgressTable = Record<string, HeroProgress>;

/** Read once, then kept in memory — the store is the only writer. */
let table: ProgressTable | undefined;

/** What a run earned for one hero, for the run-over screen. */
export interface ExpGain {
  heroId: string;
  name: string;
  exp: number;
  before: HeroProgress;
  after: HeroProgress;
  /** The passive came online with this gain. */
  unlockedPassive: boolean;
}

function load(): ProgressTable {
  if (table) return table;
  table = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProgressTable) : {};
    for (const [id, p] of Object.entries(parsed)) {
      if (typeof p?.level === 'number' && typeof p?.exp === 'number') table[id] = p;
    }
  } catch {
    // Private browsing or corrupt data: progression simply starts over.
  }
  return table;
}

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // Nothing to do — the session keeps its in-memory progress.
  }
}

export function heroProgress(heroId: string): HeroProgress {
  return load()[heroId] ?? STARTING_PROGRESS;
}

/** Every roster hero at its earned level, passives included — what the game plays with. */
export function leveledRoster(): HeroDef[] {
  return ROSTER.map(def => applyProgress(def, heroProgress(def.id)));
}

/**
 * Pays out a finished run. `party` is the run's roster (any derived copy will do — only
 * ids are read) and `runLevel` the deepest boss it reached. Persists immediately.
 */
export function grantRunExp(party: HeroDef[], runLevel: number): ExpGain[] {
  const exp = runExp(runLevel);
  const store = load();
  const gains: ExpGain[] = [];
  // A hero fielded twice cannot happen, but ids are the key — dedupe defensively.
  for (const id of new Set(party.map(h => h.id))) {
    const before = heroProgress(id);
    const after = addExp(before, exp);
    store[id] = after;
    gains.push({
      heroId: id,
      name: ROSTER.find(h => h.id === id)?.name ?? id,
      exp,
      before,
      after,
      unlockedPassive: crossedPassive(before, after),
    });
  }
  save();
  return gains;
}

function crossedPassive(before: HeroProgress, after: HeroProgress): boolean {
  return before.level < PASSIVE_LEVEL && after.level >= PASSIVE_LEVEL;
}
