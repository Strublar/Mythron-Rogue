import { PARTY_SEATS } from '../game/layout';
import type { HeroDef, HeroRole } from '../types';

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** Seats of `role` still free — a role at capacity can no longer be offered. */
function hasFreeSeat(seats: readonly (HeroDef | null)[], role: HeroRole): boolean {
  return PARTY_SEATS.some((s, i) => s.role === role && !seats[i]);
}

/**
 * The between-fights offer. Each slot rolls a random *seat* first: an occupied seat pulls
 * the offer toward one of its tags, an empty seat rolls wide. That is the synergy axis —
 * a party leaning on one tag keeps being offered more of it, an early party rolls open.
 *
 * Never offers a duplicate (already fielded, or already in this roll) or a role whose
 * seats are full, so fewer than `count` offers is legal near a full party.
 */
export function rollUnitOffers(
  count: number,
  seats: readonly (HeroDef | null)[],
  pool: HeroDef[],
): HeroDef[] {
  const offers: HeroDef[] = [];
  const taken = new Set(seats.filter((d): d is HeroDef => !!d).map(d => d.id));

  for (let i = 0; i < count; i++) {
    const candidates = pool.filter(h => !taken.has(h.id) && hasFreeSeat(seats, h.role));
    if (candidates.length === 0) break;

    const anchor = seats[Math.floor(Math.random() * seats.length)];
    // An empty seat gives nothing to match on, and neither does a tag nobody else carries.
    const sameTag = anchor
      ? candidates.filter(h => h.tags.includes(pick(anchor.tags)))
      : [];

    const offer = pick(sameTag.length > 0 ? sameTag : candidates);
    offers.push(offer);
    taken.add(offer.id);
  }

  return offers;
}
