// TODO: Full-screen card draft UI shown after each combat victory.
// Displays N card offers (typically 3). Player taps one to add to deck.
// Skip button available for gold reward.
// DraftSystem.generateDraftOffer provides the offer; pickCard/skipDraft update RunState.

import React, { useMemo } from 'react';
import { RunState } from '../types';
import { generateDraftOffer, pickCard, skipDraft } from '../roguelike/DraftSystem';
import { CARD_DB } from '../engine/CardDatabase';

interface Props {
  run: RunState;
  onPick: (updatedRun: RunState) => void;
}

const CARD_POOL = Object.values(CARD_DB);

export function DraftScreen({ run, onPick }: Props): React.ReactElement {
  const offer = useMemo(() => generateDraftOffer(run, CARD_POOL), [run]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      color: '#fff',
      fontFamily: 'monospace',
      // TODO: replace with proper styled component
    }}>
      <h2>Choose a Card</h2>
      <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
        {offer.cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => onPick(pickCard(run, offer, i))}
            style={{ padding: '16px 24px', cursor: 'pointer', fontSize: 16 }}
          >
            <div>{card.name}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{card.type} · {card.manaCost} mana</div>
            {/* TODO: show card art, effect text */}
          </button>
        ))}
      </div>
      <button
        onClick={() => onPick(skipDraft(run, 15))}
        style={{ marginTop: 24, padding: '8px 20px', cursor: 'pointer' }}
      >
        Skip (+15 gold)
      </button>
    </div>
  );
}
