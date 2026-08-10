import { DEFAULT_PARTY_IDS, ROSTER } from '../data/heroes';
import {
  DUPE_EXP, ORB_PRICE, PRISMATIC_EXP_MULT, rollOrb, rollPrismatic, runGold,
} from '../data/orbs';
import { PASSIVE_LEVEL, STARTING_PROGRESS, addExp, applyProgress, runExp } from '../data/progression';
import type { AccountState, HeroDef, HeroProgress, OrbPull } from '../types';

const STORAGE_KEY = 'mythron.progression.v2';
/** Pre-collection saves: the whole blob was the progress table, with no owned list. */
const LEGACY_KEY = 'mythron.progression.v1';

type ProgressTable = Record<string, HeroProgress>;

/** Read once, then kept in memory — the store is the only writer. */
let account: AccountState | undefined;

const isProgress = (p: HeroProgress): boolean =>
  typeof p?.level === 'number' && typeof p?.exp === 'number';

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

function load(): AccountState {
  if (account) return account;
  // A fresh account owns the seven default picks — exactly one legal party.
  account = { heroes: {}, owned: [...DEFAULT_PARTY_IDS], prismatic: [], gold: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountState>;
      readHeroes(parsed.heroes);
      if (Array.isArray(parsed.owned)) {
        // Starters stay owned whatever the save says — the party must remain fieldable.
        for (const id of parsed.owned) if (typeof id === 'string') grant(id);
      }
      // Saves written before prismatics existed simply have none.
      if (Array.isArray(parsed.prismatic)) {
        for (const id of parsed.prismatic) if (typeof id === 'string') grantPrismatic(id);
      }
      if (typeof parsed.gold === 'number' && parsed.gold >= 0) account.gold = parsed.gold;
    } else {
      // No v2 save: carry the levels a pre-collection save had earned.
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) readHeroes(JSON.parse(legacy) as ProgressTable);
    }
  } catch {
    // Private browsing or corrupt data: progression simply starts over.
  }
  return account;
}

function readHeroes(table: ProgressTable | undefined): void {
  for (const [id, p] of Object.entries(table ?? {})) {
    if (isProgress(p)) account!.heroes[id] = p;
  }
}

/** Adds an id to the owned list, ignoring one already there. */
function grant(heroId: string): void {
  if (!account!.owned.includes(heroId)) account!.owned.push(heroId);
}

/** Same, for the cosmetic variant. Owning a hero prismatic implies owning it at all. */
function grantPrismatic(heroId: string): void {
  grant(heroId);
  if (!account!.prismatic.includes(heroId)) account!.prismatic.push(heroId);
}

function save(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // Nothing to do — the session keeps its in-memory progress.
  }
}

export function heroProgress(heroId: string): HeroProgress {
  return load().heroes[heroId] ?? STARTING_PROGRESS;
}

/** Every roster hero at its earned level, passives included — what the game plays with. */
export function leveledRoster(): HeroDef[] {
  return ROSTER.map(def => applyProgress(def, heroProgress(def.id)));
}

/** Only the heroes the account has unlocked. The screens never show anything else. */
export function ownedRoster(): HeroDef[] {
  const { owned } = load();
  return leveledRoster().filter(def => owned.includes(def.id));
}

export function isOwned(heroId: string): boolean {
  return load().owned.includes(heroId);
}

/** Whether the hero's card draws the prismatic treatment. Cosmetic — never gates a pick. */
export function isPrismatic(heroId: string): boolean {
  return load().prismatic.includes(heroId);
}

export function ownedCount(): number {
  return load().owned.length;
}

export function gold(): number {
  return load().gold;
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
    store.heroes[id] = after;
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

/** Banks the run's gold alongside its exp. Returns what it paid, for the run-over screen. */
export function grantRunGold(runLevel: number): number {
  const earned = runGold(runLevel);
  load().gold += earned;
  save();
  return earned;
}

/**
 * Spends one orb. Returns `undefined` when the purse is short — the shop gates the button
 * on `gold()`, so that is a guard, not a flow. A pull that unlocks nothing pays `DUPE_EXP`
 * to the hero it rolled instead, which is why no pull is ever dead.
 *
 * The prismatic coin is drawn on top of the hero: a prismatic pull unlocks the variant even
 * for a hero already owned, so `duplicate` means "nothing new", not "hero already owned".
 */
export function buyOrb(): OrbPull | undefined {
  const store = load();
  if (store.gold < ORB_PRICE) return undefined;
  store.gold -= ORB_PRICE;

  const hero = rollOrb();
  const prismatic = rollPrismatic();
  const unlocks = prismatic ? !isPrismatic(hero.id) : !isOwned(hero.id);
  if (unlocks) {
    if (prismatic) grantPrismatic(hero.id);
    else grant(hero.id);
    save();
    return { hero, rarity: hero.rarity, duplicate: false, exp: 0, prismatic };
  }

  const exp = DUPE_EXP[hero.rarity] * (prismatic ? PRISMATIC_EXP_MULT : 1);
  const progress = addExp(heroProgress(hero.id), exp);
  store.heroes[hero.id] = progress;
  save();
  return { hero, rarity: hero.rarity, duplicate: true, exp, progress, prismatic };
}
