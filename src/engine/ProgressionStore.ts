import { ENCOUNTER_COUNT } from '../data/encounters';
import { DEFAULT_PARTY_IDS, ROSTER, defaultParty } from '../data/heroes';
import { DUPE_EXP, ORB_PRICE, rollOrb } from '../data/orbs';
import { PASSIVE_LEVEL, STARTING_PROGRESS, addExp, applyProgress } from '../data/progression';
import type { AccountState, EncounterDef, HeroDef, HeroProgress, HeroRole, OrbPull } from '../types';

const STORAGE_KEY = 'mythron.progression.v3';
/** Roguelike-era saves: levels, owned heroes and gold, but no saved party or quest progress. */
const V2_KEY = 'mythron.progression.v2';
/** Pre-collection saves: the whole blob was the progress table, with no owned list. */
const LEGACY_KEY = 'mythron.progression.v1';

type ProgressTable = Record<string, HeroProgress>;

/** Read once, then kept in memory — the store is the only writer. */
let account: AccountState | undefined;

const isProgress = (p: HeroProgress): boolean =>
  typeof p?.level === 'number' && typeof p?.exp === 'number';

/** What an encounter earned for one hero, for the result screen. */
export interface ExpGain {
  heroId: string;
  name: string;
  exp: number;
  before: HeroProgress;
  after: HeroProgress;
  /** The passive came online with this gain. */
  unlockedPassive: boolean;
}

/** What a cleared encounter paid out — everything the result screen animates. */
export interface EncounterReward {
  gains: ExpGain[];
  gold: number;
  /** This clear opened the next encounter of the chain. */
  unlocked: boolean;
}

function load(): AccountState {
  if (account) return account;
  // A fresh account owns the seven default picks — exactly one legal party — and fields them.
  account = {
    heroes: {}, owned: [...DEFAULT_PARTY_IDS], gold: 0, party: [...DEFAULT_PARTY_IDS], cleared: 0,
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(V2_KEY);
    if (raw) {
      // A v2 blob simply has no party/cleared fields — the defaults above stand.
      const parsed = JSON.parse(raw) as Partial<AccountState>;
      readHeroes(parsed.heroes);
      if (Array.isArray(parsed.owned)) {
        // Starters stay owned whatever the save says — the party must remain fieldable.
        for (const id of parsed.owned) if (typeof id === 'string') grant(id);
      }
      if (typeof parsed.gold === 'number' && parsed.gold >= 0) account.gold = parsed.gold;
      if (Array.isArray(parsed.party) && parsed.party.every(id => typeof id === 'string')) {
        account.party = [...parsed.party];
      }
      if (typeof parsed.cleared === 'number' && parsed.cleared >= 0) {
        account.cleared = Math.min(Math.floor(parsed.cleared), ENCOUNTER_COUNT);
      }
    } else {
      // No v3 or v2 save: carry the levels a pre-collection save had earned.
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

export function ownedCount(): number {
  return load().owned.length;
}

export function gold(): number {
  return load().gold;
}

/**
 * The saved roster at its earned levels. Falls back to the default seven whenever the save
 * no longer describes a fieldable party — an unowned id, a duplicate, or the wrong 2/3/2 mix.
 */
export function savedParty(): HeroDef[] {
  const roster = ownedRoster();
  const picks = load().party.map(id => roster.find(h => h.id === id));
  const party = picks.filter((h): h is HeroDef => !!h);
  return isLegalParty(party) ? party : defaultParty(roster);
}

/** Saves the roster the player just built, in slot order. */
export function setParty(party: HeroDef[]): void {
  load().party = party.map(h => h.id);
  save();
}

/** A party is legal when it has no duplicate and the same role counts as the default seven. */
function isLegalParty(party: HeroDef[]): boolean {
  if (new Set(party.map(h => h.id)).size !== party.length) return false;
  const quota = roleCounts(defaultParty());
  const counts = roleCounts(party);
  return (['tank', 'dps', 'heal'] as HeroRole[]).every(role => counts[role] === quota[role]);
}

function roleCounts(party: HeroDef[]): Record<HeroRole, number> {
  const counts: Record<HeroRole, number> = { tank: 0, dps: 0, heal: 0 };
  for (const hero of party) counts[hero.role] += 1;
  return counts;
}

/** Encounters of the chain already beaten. */
export function clearedCount(): number {
  return load().cleared;
}

/** How far up the chain the player may pick: every cleared encounter, plus the next one. */
export function unlockedCount(): number {
  return Math.min(clearedCount() + 1, ENCOUNTER_COUNT);
}

/**
 * Pays out a cleared encounter: `enc.exp` to every hero fielded, `enc.gold` to the purse,
 * and the next encounter of the chain. `party` is the roster that fought (any derived copy
 * will do — only ids are read). Persists immediately. A defeat never calls this.
 */
export function grantEncounterRewards(party: HeroDef[], enc: EncounterDef): EncounterReward {
  const exp = enc.exp;
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

  store.gold += enc.gold;
  // Replaying a cleared encounter still pays, but the chain only ever moves forward.
  const advanced = enc.index === store.cleared + 1;
  if (advanced) store.cleared = enc.index;
  save();
  // The last encounter advances the chain without opening anything after it.
  return { gains, gold: enc.gold, unlocked: advanced && enc.index < ENCOUNTER_COUNT };
}

function crossedPassive(before: HeroProgress, after: HeroProgress): boolean {
  return before.level < PASSIVE_LEVEL && after.level >= PASSIVE_LEVEL;
}

/**
 * Spends one orb. Returns `undefined` when the purse is short — the shop gates the button
 * on `gold()`, so that is a guard, not a flow. A hero already owned pays `DUPE_EXP` to
 * itself instead of unlocking, which is why no pull is ever dead.
 */
export function buyOrb(): OrbPull | undefined {
  const store = load();
  if (store.gold < ORB_PRICE) return undefined;
  store.gold -= ORB_PRICE;

  const hero = rollOrb();
  const duplicate = isOwned(hero.id);
  if (!duplicate) {
    grant(hero.id);
    save();
    return { hero, rarity: hero.rarity, duplicate: false, exp: 0 };
  }

  const exp = DUPE_EXP[hero.rarity];
  const progress = addExp(heroProgress(hero.id), exp);
  store.heroes[hero.id] = progress;
  save();
  return { hero, rarity: hero.rarity, duplicate: true, exp, progress };
}
