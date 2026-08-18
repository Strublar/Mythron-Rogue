import type { ArtifactDef, HeroDef, HeroRarity } from '../types';
import { ARTIFACT_POOL } from './artifacts';
import { RECRUIT_POOL } from './heroes';
import { RARITY_ORDER, RARITY_WEIGHT } from './rarity';

const pick = <T>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

/**
 * The free recruit offer. Each slot rolls a random *seat* first: the seated hero pulls the
 * offer toward one of its tags. That is the synergy axis — a party leaning on one tag keeps
 * being offered more of it. Never offers a hero already fielded or already in this roll.
 */
export function rollRecruitOffers(
  count: number,
  seats: readonly HeroDef[],
  rng: () => number = Math.random,
): HeroDef[] {
  const taken = new Set(seats.map(d => d.id));
  const offers: HeroDef[] = [];

  for (let i = 0; i < count; i++) {
    const candidates = RECRUIT_POOL.filter(h => !taken.has(h.id));
    if (candidates.length === 0) break;

    const anchor = pick([...seats], rng);
    // A tag nobody in the pool shares gives nothing to match on — roll wide instead.
    const sameTag = candidates.filter(h => h.tags.includes(pick(anchor.tags, rng)));

    const offer = pick(sameTag.length > 0 ? sameTag : candidates, rng);
    offers.push(offer);
    taken.add(offer.id);
  }

  return offers;
}

/** A rarity drawn on `RARITY_WEIGHT`, restricted to tiers the remaining pool still has. */
function rollRarity(pool: { rarity: HeroRarity }[], rng: () => number): HeroRarity {
  const tiers = RARITY_ORDER.filter(r => RARITY_WEIGHT[r] > 0 && pool.some(h => h.rarity === r));
  const total = tiers.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
  let ticket = rng() * total;
  for (const rarity of tiers) {
    ticket -= RARITY_WEIGHT[rarity];
    if (ticket < 0) return rarity;
  }
  return tiers[tiers.length - 1];
}

/**
 * The shop's three. Unlike the recruit roll this one is rarity-weighted, not tag-anchored:
 * gold is what decides here, so a legendary showing up is the event worth saving for.
 * `exclude` keeps the shop off the heroes the recruit step just offered.
 */
export function rollShopOffers(
  count: number,
  seats: readonly HeroDef[],
  exclude: readonly HeroDef[] = [],
  rng: () => number = Math.random,
): HeroDef[] {
  const taken = new Set([...seats, ...exclude].map(d => d.id));
  const offers: HeroDef[] = [];

  for (let i = 0; i < count; i++) {
    const candidates = RECRUIT_POOL.filter(h => !taken.has(h.id));
    if (candidates.length === 0) break;

    const rarity = rollRarity(candidates, rng);
    const offer = pick(candidates.filter(h => h.rarity === rarity), rng);
    offers.push(offer);
    taken.add(offer.id);
  }

  return offers;
}

/**
 * The shop's gear, rolled on the same rarity weights as its heroes. Artifacts already
 * worn never come back — there is nothing to gain from a second copy.
 */
export function rollArtifactOffers(
  count: number,
  owned: ReadonlySet<string>,
  rng: () => number = Math.random,
): ArtifactDef[] {
  const taken = new Set(owned);
  const offers: ArtifactDef[] = [];

  for (let i = 0; i < count; i++) {
    const candidates = ARTIFACT_POOL.filter(a => !taken.has(a.id));
    if (candidates.length === 0) break;

    const rarity = rollRarity(candidates, rng);
    const offer = pick(candidates.filter(a => a.rarity === rarity), rng);
    offers.push(offer);
    taken.add(offer.id);
  }

  return offers;
}
