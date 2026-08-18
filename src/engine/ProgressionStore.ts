import { DEFAULT_PARTY_IDS, ROSTER } from '../data/heroes';
import {
  DUPE_EXP, ORB_PRICE, PRISMATIC_EXP_MULT, rollOrb, rollPrismatic, runGold,
} from '../data/orbs';
import { PASSIVE_LEVEL, STARTING_PROGRESS, addExp, applyProgress, runExp } from '../data/progression';
import { PARTY_SEATS, SEAT_COUNT } from '../game/layout';
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
  // A fresh account owns the seven default picks — exactly one legal party, already seated.
  account = {
    heroes: {},
    owned: [...DEFAULT_PARTY_IDS],
    prismatic: [],
    gold: 0,
    team: defaultTeam(),
    maxDifficulty: 1,
  };
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
      // Saves written before the team was built between runs keep the default seating.
      if (Array.isArray(parsed.team)) account.team = readTeam(parsed.team);
      if (typeof parsed.maxDifficulty === 'number' && parsed.maxDifficulty >= 1) {
        account.maxDifficulty = Math.floor(parsed.maxDifficulty);
      }
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

/** The starters seated into the 2/3/2 they were picked to fill. */
function defaultTeam(): (string | null)[] {
  const pool = DEFAULT_PARTY_IDS.map(id => ROSTER.find(h => h.id === id)).filter(Boolean) as HeroDef[];
  return PARTY_SEATS.map(seat => {
    const i = pool.findIndex(h => h.role === seat.role);
    return i >= 0 ? pool.splice(i, 1)[0].id : null;
  });
}

/**
 * A saved team, normalised: seven seats, no id twice, and a hero only where its role fits.
 * Anything else — a shorter array, a renamed hero — reads as an empty seat.
 */
function readTeam(saved: unknown[]): (string | null)[] {
  const seen = new Set<string>();
  return PARTY_SEATS.map((seat, i) => {
    const id = saved[i];
    if (typeof id !== 'string' || seen.has(id)) return null;
    if (ROSTER.find(h => h.id === id)?.role !== seat.role) return null;
    seen.add(id);
    return id;
  });
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
 * The seated team, one entry per seat. A hero the account no longer owns reads as empty —
 * ownership can only ever be gained today, but the team is the one place it would show.
 */
export function team(): (string | null)[] {
  const { team: seats, owned } = load();
  return seats.map(id => (id && owned.includes(id) ? id : null));
}

/** The seated team as fieldable defs: account level and passive folded in. */
export function teamDefs(): (HeroDef | null)[] {
  const roster = leveledRoster();
  return team().map(id => roster.find(def => def.id === id) ?? null);
}

/**
 * Seats a hero, or clears the seat with `null`. A hero already sitting somewhere else moves
 * rather than duplicates, so a swap is a single tap. Persists immediately.
 */
export function setTeamSeat(seat: number, heroId: string | null): void {
  const store = load();
  if (seat < 0 || seat >= SEAT_COUNT) return;
  if (heroId) {
    const elsewhere = store.team.indexOf(heroId);
    // Moving a seated hero leaves its old seat empty — the swap target, if any, is displaced.
    if (elsewhere >= 0) store.team[elsewhere] = store.team[seat];
  }
  store.team[seat] = heroId;
  save();
}

/** How far up the ladder the account may pick. */
export function maxDifficulty(): number {
  return load().maxDifficulty;
}

/** Banks a clear. Returns true when it opened the next rung — the overlay says so. */
export function recordClear(difficulty: number): boolean {
  const store = load();
  if (difficulty < store.maxDifficulty) return false;
  store.maxDifficulty = difficulty + 1;
  save();
  return true;
}

/**
 * Pays out a cleared boss. `party` is the team that fought it (any derived copy will do —
 * only ids are read) and `difficulty` the rung it was fought on. Persists immediately.
 */
export function grantRunExp(party: HeroDef[], difficulty: number): ExpGain[] {
  const exp = runExp(difficulty);
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

/** Banks the run's gold alongside its exp. Returns what it paid, for the result screen. */
export function grantRunGold(difficulty: number): number {
  const earned = runGold(difficulty);
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
