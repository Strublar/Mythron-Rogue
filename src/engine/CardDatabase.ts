// Card definitions (plain data objects — no factory, no switch/case) + deck builder.
// Summon cards reference UnitAnimator atlas keys via effect.unitKey; those atlases
// must be preloaded in CombatScene and registered in UNIT_DEFS.

import { CardDefinition, CardInstance, CardTargeting } from '../types';

/** Atlas keys for every summonable minion — CombatScene preloads these. */
export const SUMMON_ATLASES = [
  'f1_silverguardsquire',
  'f1_sunriser',
  'f1_silvermanevanguard',
  'f1_ironcliffeguardian',
] as const;

export const CARD_DB: Record<string, CardDefinition> = {
  squire: {
    id: 'squire',
    name: 'Silverguard Squire',
    type: 'unit',
    manaCost: 1,
    description: 'Summon a 2/4 guard.',
    effect: { kind: 'summon', unitKey: 'f1_silverguardsquire', stats: { maxHp: 4, hp: 4, attack: 2, moveRange: 2, attackRange: 1 } },
  },
  sunriser: {
    id: 'sunriser',
    name: 'Sunriser',
    type: 'unit',
    manaCost: 4,
    description: 'Summon a 3/5 caster.',
    effect: { kind: 'summon', unitKey: 'f1_sunriser', stats: { maxHp: 5, hp: 5, attack: 3, moveRange: 2, attackRange: 1 } },
  },
  vanguard: {
    id: 'vanguard',
    name: 'Silvermane Vanguard',
    type: 'unit',
    manaCost: 3,
    description: 'Summon a 4/5 striker.',
    effect: { kind: 'summon', unitKey: 'f1_silvermanevanguard', stats: { maxHp: 5, hp: 5, attack: 4, moveRange: 2, attackRange: 1 } },
  },
  ironcliffe: {
    id: 'ironcliffe',
    name: 'Ironcliffe Guardian',
    type: 'unit',
    manaCost: 5,
    description: 'Summon a 3/10 wall.',
    effect: { kind: 'summon', unitKey: 'f1_ironcliffeguardian', stats: { maxHp: 10, hp: 10, attack: 3, moveRange: 1, attackRange: 1 } },
  },
  firebolt: {
    id: 'firebolt',
    name: 'Firebolt',
    type: 'spell',
    manaCost: 2,
    description: 'Deal 3 damage to an enemy.',
    effect: { kind: 'damage', amount: 3 },
  },
  mend: {
    id: 'mend',
    name: 'Mend',
    type: 'spell',
    manaCost: 2,
    description: 'Restore 3 HP to a friendly unit.',
    effect: { kind: 'heal', amount: 3 },
  },
};

export function getCardDef(definitionId: string): CardDefinition | undefined {
  return CARD_DB[definitionId];
}

/** Find the summon card whose minion matches a board unit's definitionId (unitKey). */
export function getCardDefByUnitKey(unitKey: string): CardDefinition | undefined {
  return Object.values(CARD_DB).find(
    d => d.effect.kind === 'summon' && d.effect.unitKey === unitKey,
  );
}

/** Where a card may be played — drives target-tile highlighting. */
export function targetingFor(def: CardDefinition): CardTargeting {
  switch (def.effect.kind) {
    case 'summon': return 'emptyAdjacent';
    case 'damage': return 'enemyUnit';
    case 'heal':   return 'friendlyUnit';
  }
}

let instanceCounter = 0;
export function makeCardInstance(definitionId: string): CardInstance {
  return { instanceId: `card-${definitionId}-${instanceCounter++}`, definitionId };
}

/** Fisher–Yates shuffle (returns new array). */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Default starter draw pile (shuffled instances). */
export function buildStarterDeck(): CardInstance[] {
  const recipe: Array<[string, number]> = [
    ['squire', 3],
    ['vanguard', 2],
    ['sunriser', 2],
    ['ironcliffe', 1],
    ['firebolt', 2],
    ['mend', 2],
  ];
  const cards: CardInstance[] = [];
  for (const [id, count] of recipe) {
    for (let i = 0; i < count; i++) cards.push(makeCardInstance(id));
  }
  return shuffle(cards);
}
