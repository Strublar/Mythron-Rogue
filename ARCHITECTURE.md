# ARCHITECTURE.md — Mythron

## File Map

```
/
├── index.html                          # HTML shell + #rotate-gate portrait fallback overlay
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.json                   # PWA manifest (portrait, fullscreen)
│   ├── sw.js
│   └── resources/
│       ├── units/                      # {unit}.png + {unit}_atlas.json (+ original .plist)
│       ├── maps/ scenes/ ui/ generals/ # static PNG/JPG backdrops and UI art
│       └── fonts/                      # Lato
├── scripts/
│   ├── plist-to-atlas.mjs              # Cocos2d .plist → Phaser JSON atlas
│   ├── batch-plist-to-atlas.mjs        # npm run plist-to-atlas
│   ├── extract-sprites.mjs             # npm run extract-sprites
│   ├── generate-unit-catalog.mjs       # npm run unit-catalog → docs/units/
│   ├── generate-spell-catalog.mjs      # npm run spell-catalog → docs/spells/ + docs/artifacts/
│   └── lib/plist.mjs                   # Shared Cocos2d .plist frame reader
├── docs/
│   ├── units/                          # Generated sprite catalog, one .md per faction + thumbs/
│   ├── spells/                         # Generated spell catalog (icon + VFX), per faction + thumbs/
│   └── artifacts/                      # Generated artifact icon catalog, per faction + thumbs/
└── src/
    ├── main.ts                         # Entry: boots Phaser, preloads Lato, registers sw
    ├── types/
    │   └── index.ts                    # ALL shared types/interfaces (source of truth)
    ├── data/
    │   ├── heroes.ts                   # ROSTER (20 heroes) + heroesByRole + defaultParty + threat tuning
    │   ├── abilities.ts                # One Ability per hero — the roster's identity
    │   ├── statMath.ts                 # grow()/haste()/growHero() percent math (buffs, levels)
    │   ├── progression.ts              # Levels 1–10: per-level growth, exp curve, applyProgress
    │   ├── passives.ts                 # PASSIVES — one per hero, unlocked at level 5
    │   ├── orbs.ts                     # Rarity tiers/odds, orb price, dupe exp, encounterGold, rollOrb
    │   ├── encounters.ts               # The quest chain: encounterAt(index) → boss + exp/gold
    │   └── bosses.ts                   # Boss definitions + bossForLevel scaling
    ├── engine/
    │   ├── FightEngine.ts              # Real-time fight sim: cooldowns, auto-acts, casts
    │   └── ProgressionStore.ts         # localStorage account: levels, owned, gold, party, cleared
    └── game/
        ├── PhaserGame.ts               # Phaser.Game config (720×1280 portrait, FIT)
        ├── layout.ts                   # Slot coordinates, scales, bar/ground offsets
        ├── orientation.ts              # Portrait lock (Screen Orientation API + fullscreen)
        ├── UnitAnimator.ts             # UNIT_DEFS registry + atlas anim registration
        ├── CombatantView.ts            # Sprite + health bar + cooldown bar + ready ring + threat bar/aggro mark
        ├── ui.ts                       # Shared btn_confirm button factory + scene backdrop/label
        ├── HealthBar.ts                # Reusable HP/shield bar (heroes and boss)
        ├── HeroTooltip.ts              # Long-press stats card: level, stats, passive, ability values
        ├── HeroInspector.ts            # Shared long-press-to-inspect: timer, drag guard, slot probes
        ├── ExpBar.ts                   # Shared exp bar: track, fill, caption — setProgress to animate
        ├── HeroCard.ts                 # Roster grid card: portrait, name, stat strip, level/exp, tap/hold
        ├── DragCastController.ts       # Drag-to-cast: arrow, target highlight, hit test
        └── scenes/
            ├── BootScene.ts            # Preloads unit atlases (from UNIT_DEFS) + backdrops
            ├── MainMenuScene.ts        # Title + QUEST (encounter picker) + ROSTER/COLLECTION/SHOP links
            ├── CollectionScene.ts      # Hero levels/exp per role tab (owned only)
            ├── ShopScene.ts            # Orb shop: gold, buy, rarity reveal, duplicate exp
            ├── RosterScene.ts          # Roster editor on the battlefield slots; SAVE persists the party
            ├── BossFightScene.ts       # Layout, engine ↔ view wiring, encounter payout hand-off
            └── ResultScene.ts          # Victory/defeat: animated exp bars per hero + gold, MENU / NEXT
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → BossFightScene → ResultScene → MainMenuScene
        MainMenuScene also opens RosterScene / CollectionScene / ShopScene
        MainMenuScene hands BossFightScene.init { party: savedParty(), encounter }
        BossFightScene owns:
          FightEngine        (pure state; emits 'fight' FightEvents)
          CombatantView × 8  (1 boss + 7 heroes)
          DragCastController (input → engine.castAbility)
        update(dt) → engine.tick(dt) → events → view animations
        'end' → grantEncounterRewards (victory only) → ResultScene
```

## Key Constraints

- **Portrait, mobile only.** 720×1280 base, `Scale.FIT`. Boss in the top half, the
  party's three rows in the bottom half.
- **Party:** 7 heroes — 2 tanks (front), 3 dps (mid), 2 heals (back). `HERO_SLOTS`
  in `layout.ts` is the single source of slot positions; `withSlots(defs)` hands them out.
- **Game loop.** One boss encounter at a time, no runs. `MainMenuScene` is the hub: QUEST
  fights the picked encounter with the saved roster, ROSTER edits that roster, COLLECTION and
  SHOP are the collection pages. `BossFightScene` fights exactly one `EncounterDef` and hands
  over to `ResultScene`, which pays out and offers MENU / NEXT (or RETRY).
- **Quest chain.** `encounters.ts` is the single source of what an encounter is: the boss
  (`bossForLevel(index)`, the same scaling the endless run used) plus `encounterExp(index)` and
  `encounterGold(index)`. `ENCOUNTER_COUNT` (8) caps the chain. `cleared` in `AccountState`
  tracks progress; `unlockedCount() = cleared + 1` is how far the menu's chevrons may step, so a
  beaten encounter can be replayed for its payout but never skipped.
- **Roster.** `ROSTER` holds 20 heroes (5 tanks / 9 dps / 6 heals), each with its own stats and
  its own `Ability`. `RosterScene` seeds from `savedParty()`, draws the picks at their real
  `HERO_SLOTS`, opens a role grid in the boss zone on tap, and `SAVE` writes the ids back through
  `setParty`. `savedParty()` falls back to `defaultParty(ownedRoster())` whenever the save is no
  longer a legal, owned 2/3/2.
- **Abilities** are pure data (`src/data/abilities.ts`). Primitives the engine resolves:
  `damage`, `heal`, `partyHeal`, `selfHeal`, `selfShield`, `allyShield`, `taunt`,
  `lifestealPct`, `bossStunMs`, `executeBelowPct`/`executeBonus`, `threatFlat`, `dot`
  (bleeds the boss over time) and `buff` (timed `attackPct`/`attackSpeedPct` on
  self/ally/party). Adding a field means adding a line to `abilityEffects` in
  `HeroTooltip.ts` — that function is the only place ability copy is written.
- **Buffs.** Levels bake into `HeroDef` via `applyProgress`; buffs are temporary and ride on
  `HeroState.buffs`, folded in by `heroAttack`/`heroInterval` at tick time. Both use
  `grow`/`haste` from `src/data/statMath.ts`.
- **Real-time, but the fight only starts on the first ability cast.** Until then every
  actor idles (`FightEngine.started`). Heroes then auto-attack (healers auto-heal the
  lowest-HP ally). During that idle window a long press on a hero opens its stats card;
  the first cast switches hero pointer-down back to drag-cast alone.
- **Threat.** Damage dealt and hp healed add threat, weighted per role
  (`ROLE_THREAT_MULTIPLIER`); the boss always swings at the highest-threat living hero.
  A tank ability is a taunt: it wipes party threat and plants `TAUNT_THREAT` on the caster.
- **Tags.** Every hero carries two `HeroTag`s — a faction (`lyonar` … `mercenary`) and an
  archetype (`arcanyst`, `blade`, `golem`, `beast`, `blood`). They are identity and card copy
  (`tagStrip`), nothing mechanical.
- **Triggers.** A passive is `on` (fight event or `interval`) + `when` (threshold, 1-in-N,
  internal cooldown, once-per-fight) + `do` (boss damage, heal, shield, timed buff, dot,
  cooldown refund, stagger, taunt, free recast) — the `BoonTriggerSpec` shape in `types`.
  Every engine state change leaves through `FightEngine.signal`, which emits the `FightEvent`
  and then walks the owned triggers; `runAction` resolves payloads through the ordinary
  primitives, so views animate them for free. Trigger payloads never wake other triggers
  (`firing` guard, one level deep).
- **Progression.** Every hero carries an account-wide level (1–10) persisted in
  `localStorage` by `ProgressionStore`. `leveledRoster()` folds it in once: `applyProgress`
  grows the base stats by `LEVEL_GROWTH × (level-1)` and, from `PASSIVE_LEVEL` (5), attaches the
  hero's `PASSIVES` entry. A cleared encounter pays `enc.exp` to every hero fielded — one call,
  `grantEncounterRewards`, made by `BossFightScene` before it opens `ResultScene`, which then
  animates the returned `ExpGain`s through the shared `ExpBar` (`addExp` drives the tween, so a
  bar that fills mid-animation rolls into the next level). A defeat pays nothing.
  `CollectionScene` is the browsing page: one role tab at a time, level badge, exp bar, hold
  for the full card.
- **Collection.** Heroes are *owned*, not given. A fresh account owns exactly the seven
  `DEFAULT_PARTY_IDS` — one legal 2/3/2 — and `ownedRoster()` is what both the select grid and
  the collection page read, so an unowned hero is never drawn anywhere. Each `HeroDef` carries a
  `rarity` (`B`/`A`/`S`, 10/7/3 heroes) which is pull weight and card tint only, never stats.
  A cleared encounter also pays `encounterGold(index)`, so later encounters fund faster.
  `ShopScene` spends it: `buyOrb()` deducts `ORB_PRICE`, draws a tier on `RARITY_WEIGHT`
  (70/25/5) then a hero uniformly inside it, and either unlocks that hero or — if already
  owned — pays it `DUPE_EXP` through the same `addExp` levels use, so no pull is dead and a
  complete collection keeps orbs worth buying. `ProgressionStore` remains the only writer; its
  key is `mythron.progression.v3` (`AccountState`: levels, owned, gold, party, cleared), reading
  a v2 blob in place when there is no v3 one and falling back to v1 levels, always seeding the
  starters.
- **Passives** ride the trigger machinery, owner-scoped: a `TriggerSlot` carries its `ownerId`,
  wakes only on that hero's events, `'scope'` targets resolve to that hero alone, and a dead
  owner's passive lies dormant. `HeroTooltip` shows a locked passive greyed with its unlock
  level, so leveling has a visible goal.
- **Casting.** Drag a hero onto the target its ability's `targetKind` names — the boss or an
  ally. Role never gates it. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map.
- VFX: Phaser tweens/graphics only.
