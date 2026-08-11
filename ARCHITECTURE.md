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
    │   ├── generals.ts                 # GENERALS (6 faction generals) — the run's starting unit
    │   ├── unitDraft.ts                # rollUnitOffers: seat-anchored, tag-weighted recruit offers
    │   ├── abilities.ts                # One Ability per hero — the roster's identity
    │   ├── statMath.ts                 # grow()/haste()/growHero() percent math + armor, crit, power math
    │   ├── boons.ts                    # Boon pool, roll, effect text, applyBoons — unused by the run loop
    │   ├── progression.ts              # Levels 1–10: per-level growth, exp curve, applyProgress
    │   ├── passives.ts                 # PASSIVES — one per hero, unlocked at level 5
    │   ├── orbs.ts                     # Rarity tiers/odds, orb price, dupe exp, runGold, rollOrb
    │   └── bosses.ts                   # Boss definitions
    ├── engine/
    │   ├── FightEngine.ts              # Real-time fight sim: cooldowns, auto-acts, casts
    │   ├── ProgressionStore.ts         # localStorage account: levels, owned heroes, gold, buyOrb()
    │   └── RunState.ts                 # The run's party as a sparse 7-seat array; grows per fight
    └── game/
        ├── PhaserGame.ts               # Phaser.Game config (720×1280 portrait, FIT)
        ├── layout.ts                   # Slot coordinates, PARTY_SEATS, scales, bar/ground offsets
        ├── orientation.ts              # Portrait lock (Screen Orientation API + fullscreen)
        ├── UnitAnimator.ts             # UNIT_DEFS registry + atlas anim registration
        ├── CombatantView.ts            # Sprite + health bar + mana bar + ready ring + threat bar/aggro mark
        ├── ui.ts                       # Shared btn_confirm button factory + scene backdrop/label
        ├── HealthBar.ts                # Reusable HP/shield bar (heroes and boss)
        ├── HeroTooltip.ts              # Long-press stats card: level, colour-coded stat grid, passive, ability values
        ├── statDisplay.ts               # STAT_COLOR + heroStatRows: the one stat palette and row order
        ├── HeroInspector.ts            # Shared long-press-to-inspect: timer, drag guard, slot probes
        ├── BoonCard.ts                 # Boon offer card — unused by the run loop, kept with boons.ts
        ├── HeroCard.ts                 # Roster grid card: portrait, name, stat strip, level/exp, tap/hold
        ├── BoonListPanel.ts            # "BOONS" overlay — unused by the run loop, kept with boons.ts
        ├── PrismaticFx.ts              # Foil treatment: texture map + orbiting gradients + shine sweep
        ├── PrismaticBurst.ts           # Prismatic reveal flourish: gradient floor, rays, sparks
        ├── DragCastController.ts       # Drag-to-cast: arrow, target highlight, hit test
        └── scenes/
            ├── BootScene.ts            # Preloads unit atlases (from UNIT_DEFS) + backdrops
            ├── MainMenuScene.ts        # Title + FIGHT BOSS + COLLECTION/SHOP links
            ├── CollectionScene.ts      # Between-runs hero levels/exp per role tab (owned only)
            ├── ShopScene.ts            # Orb shop: gold, buy, rarity reveal, duplicate exp
            ├── GeneralSelectScene.ts   # Pre-run general pick: 6-card grid + the seated preview
            ├── BossFightScene.ts       # Layout, engine ↔ view wiring, end overlay
            └── InterludeScene.ts       # Between-fights unit draft in the boss zone (+ hero long-press probes)
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → GeneralSelectScene → BossFightScene
        GeneralSelectScene hands BossFightScene.init the chosen general (one HeroDef)
        BossFightScene owns:
          FightEngine        (pure state; emits 'fight' FightEvents)
          CombatantView      (1 boss + the party, which grows from 1 hero to 7)
          DragCastController (input → engine.castAbility)
        update(dt) → engine.tick(dt) → events → view animations
```

## Key Constraints

- **Portrait, mobile only.** 720×1280 base, `Scale.FIT`. Boss in the top half, the
  party's three rows in the bottom half.
- **Party:** at most 7 heroes — 2 tanks (front), 3 dps (mid), 2 heals (back), but a run
  *starts with one*. `HERO_SLOTS` in `layout.ts` is the single source of slot positions;
  `PARTY_SEATS` names the seven seats in row order and `seatedSlots(seats)` hands slots to
  the filled ones. `RunState` owns that sparse seat array — `party()` (filled, seat order),
  `nextSeat(role)`, `addUnit(def)`, `isFull()`.
- **The run loop.** `GeneralSelectScene` picks 1 of the 6 `GENERALS`; it seeds
  `new RunState(general)`, which seats it at `GENERAL_SEAT` (the centre dps slot) and sends
  it into boss 1 **alone**. Every cleared boss opens `InterludeScene`, which offers 3 units
  to recruit; the pick takes the first free seat of its role. Six clears fill the party to
  2/3/2 — after that encounters pay nothing for the rest of the run. RETRY after a defeat
  returns to the general select; a new run is a new general.
- **Generals.** `src/data/generals.ts` holds 6 `HeroDef`s (one per faction, `f1..f6_general`
  art), all `role: 'dps'` and beefier than a roster dps because they solo boss 1. They are
  *not* in `ROSTER`, so they never appear in a draft offer, the collection, or an orb pull,
  and they are always selectable.
- **Recruit offers.** `rollUnitOffers(count, seats, ROSTER)` in `src/data/unitDraft.ts`. Each
  offer rolls a random *seat* first: an occupied seat picks one of that hero's tags and
  narrows the pool to units sharing it, an empty seat rolls wide. Never offers a duplicate
  (fielded or already in the roll) or a role whose seats are full, so a near-full party gets
  fewer than 3 offers and a full one gets none. Ownership is ignored — the whole `ROSTER` is
  draftable, and so are account levels: everyone fights at base stats.
- **Stats.** Every `HeroDef` carries eight combat numbers: `maxHp`, `hpRegen` (hp/s),
  `armor`, `attack` + `attackIntervalMs`, `power`, `critChance` and `manaRegen` (mana/s).
  Armor mitigates TFT-style — `mitigate()` in `statMath.ts` cuts a hit by
  `armor/(armor+100)`. `power` is the ability scalar: every payload in `abilities.ts` is
  written at `BASE_POWER` (100) and `scaleByPower` folds the caster's power in at cast
  time, so ability numbers live in exactly one place and the tooltip prints the scaled
  value. `critChance` is rolled once per auto-attack and once per cast, multiplying that
  hit's damage *and* healing by `CRIT_MULT` (1.5) — shields and bleeds never crit.
  `hpRegen` and `manaRegen` trickle in `FightEngine.tickRegen`, silently: no event, no
  threat, since the views read hp and mana off the state every frame.
- **Mana, not cooldowns.** An `Ability` costs `manaCost`; `HeroState.mana` banks toward it
  at the hero's `manaRegen` and a cast spends it. Heroes start every fight at full mana —
  the fight itself only begins on the first cast, so someone has to be able to open it.
  `abilityProgress` is the fill ratio behind `CombatantView`'s blue mana bar.
- **Abilities** are pure data (`src/data/abilities.ts`). Primitives the engine resolves:
  `damage`, `heal`, `partyHeal`, `selfHeal`, `selfShield`, `allyShield`, `taunt`,
  `lifestealPct`, `bossStunMs`, `executeBelowPct`/`executeBonus`, `threatFlat`, `dot`
  (bleeds the boss over time) and `buff` (timed `attackPct`/`attackSpeedPct` on
  self/ally/party). Adding a field means adding a line to `abilityEffects` in
  `HeroTooltip.ts` — that function is the only place ability copy is written.
- **Stat colours.** `src/game/statDisplay.ts` owns the Teamfight-Tactics-style palette
  (`STAT_COLOR`: green hp, orange attack, gold armor, violet power, pink crit, blue mana)
  and `heroStatRows`, the label/value/colour rows the tooltip lays out two per line.
  Anything that prints a stat pulls its colour from there — crit pop-ups included.
- **Buffs.** Temporary, riding on `HeroState.buffs` and folded in by `heroAttack`/
  `heroInterval` at tick time, using `grow`/`haste` from `src/data/statMath.ts`.
- **Real-time, but the fight only starts on the first ability cast.** Until then every
  actor idles (`FightEngine.started`). Heroes then auto-attack (healers auto-heal the
  lowest-HP ally). During that idle window a long press on a hero opens its stats card;
  the first cast switches hero pointer-down back to drag-cast alone.
- **Threat.** Damage dealt and hp healed add threat, weighted per role
  (`ROLE_THREAT_MULTIPLIER`); the boss always swings at the highest-threat living hero.
  A tank ability is a taunt: it wipes party threat and plants `TAUNT_THREAT` on the caster.
- **Tags.** Every hero carries two `HeroTag`s — a faction (`lyonar` … `mercenary`) and an
  archetype (`arcanyst`, `blade`, `golem`, `beast`, `blood`). Tags are the synergy axis of
  the recruit draft: rolling a seat and then one of its occupant's tags means a party
  leaning on a tag keeps being offered more of it, weighted naturally by how many seats
  carry it, while empty seats keep an early party's offers wide.
- **Trigger boons** *(machinery only — boons are not part of the run loop)*. A boon carries `effect` (permanent stats), `trigger` (a `BoonTriggerSpec`),
  or both. A trigger is `on` (fight event or `interval`) + `when` (scope gate, threshold,
  1-in-N, internal cooldown, once-per-fight) + `do` (boss damage, heal, shield, timed buff,
  dot, cooldown refund, stagger, taunt, free recast). Every engine state change leaves through
  `FightEngine.signal`, which emits the `FightEvent` and then walks the owned triggers;
  `runAction` resolves payloads through the ordinary primitives, so views animate them for
  free. Trigger payloads never wake other triggers (`firing` guard, one level deep). Owning a
  boon twice fires it twice — no percentage stacking. `setBoons` hands the engine the run's
  boons; per-fight counters reset in `startNextBoss`.
- **Progression** *(account-side only — the run does not read it)*. Every hero carries an
  account-wide level (1–10) persisted in `localStorage` by `ProgressionStore`;
  `leveledRoster()` folds it in via `applyProgress` (base stats grown by
  `LEVEL_GROWTH × (level-1)`, plus the `PASSIVES` entry from `PASSIVE_LEVEL` (5)). Only
  `CollectionScene` reads it today — a run fields everyone at base stats. A finished run still
  pays `runExp(level)` to every hero fielded (`grantRunExp`, called from the run-over overlay),
  so exp scales with how deep the run got. `CollectionScene` is the between-runs page: one role
  tab at a time, level badge, exp bar, hold for the full card.
- **Collection.** Heroes are *owned*, not given. A fresh account owns exactly the seven
  `DEFAULT_PARTY_IDS` — one legal 2/3/2 — and `ownedRoster()` is what the collection page reads,
  so an unowned hero is never drawn there. Ownership does **not** gate the run: the recruit draft
  offers the whole `ROSTER`, and every general is always available. Each `HeroDef` carries a
  `rarity` (`B`/`A`/`S`, 10/7/3 heroes) which is pull weight and card tint only, never stats.
  A finished run also pays `runGold(level)` — a flat base plus a triangular sum over the levels
  cleared, so deep runs fund faster. `ShopScene` spends it: `buyOrb()` deducts `ORB_PRICE`, draws
  a tier on `RARITY_WEIGHT` (70/25/5) then a hero uniformly inside it, and either unlocks that
  hero or — if already owned — pays it `DUPE_EXP` through the same `addExp` levels use, so no
  pull is dead and a complete collection keeps orbs worth buying. `ProgressionStore` remains the
  only writer; its key is `mythron.progression.v2` (`AccountState`), migrating a v1 blob's levels
  and seeding the starters.
- **Prismatics.** Duelyst's foil variant, ported from its CC0 art in
  `public/resources/prismatic/`. An orb draws `rollPrismatic()` (10%) on top of the hero it
  rolled; a prismatic pull unlocks the variant even for a hero already owned, so `OrbPull.duplicate`
  means "nothing new", not "hero already owned", and a prismatic duplicate pays `PRISMATIC_EXP_MULT ×
  DUPE_EXP`. `AccountState.prismatic` is the owned list — additive to the `v2` blob, so an older save
  simply reads `[]`. Purely cosmetic: it never touches stats, odds, or which heroes are fieldable.
  `prismaticSwirl` (three additive gradients orbiting on 10/15/20s periods plus a shine band, clipped
  by a geometry mask) is the reusable layer behind both a `HeroCard` and the shop panel;
  `prismaticBurst` is the one-shot reveal flourish. Both destroy their own tweens and mask on
  `DESTROY` — the grids rebuild constantly and only ever destroy display objects.
- **Passives** ride the boon trigger machinery, owner-scoped: a `TriggerSlot` with `ownerId`
  only wakes on its owner's events, `'scope'` targets resolve to that hero alone, and a dead
  owner's passive lies dormant. `HeroTooltip` shows a locked passive greyed with its unlock
  level. Dormant in a run today — a run fields base-stat, level-1 defs, so no passive attaches.
- **Boons** are not part of the run loop. `src/data/boons.ts`, `BoonCard` and `BoonListPanel`
  are kept intact and unreferenced; the engine's trigger machinery still backs passives.
- **A growing party.** `FightEngine.startNextBoss` rebuilds its `heroes` from the `heroDefs`
  handed to it (`makeHeroStates`, shared with the constructor) — a fresh fight resets every
  hero anyway, which is what lets a recruit join mid-run. `BossFightScene.addHeroView` is the
  matching view side: sprite, bars, `DragCastController.register`, and the long-press probe,
  used both for the general at run start and for each recruit.
- **Between fights.** A cleared boss freezes `BossFightScene` (`frozen` stops the sim, input
  goes off) and launches `InterludeScene`, which offers 3 units. The scene is *not* paused —
  a paused scene stops its UpdateList, and the party must keep idling under the offer window.
  Tapping an offer only selects it: a pulsing ring marks the seat it would fill
  (`RunState.nextSeat`) and `RECRUIT` hands it back, resuming the fight scene, which seats the
  unit and spawns the next boss. A full party gets `PARTY COMPLETE` and a plain `CONTINUE`.
  The interlude draws no full-screen overlay — only a result window in the vacated boss zone —
  so the party rows stay visible. The frozen scene takes no input, so the interlude owns its
  own invisible probe zones over `HERO_SLOTS` (`HeroInspector.addProbes`).
- **Boss scaling.** `SHADOWLORD` is tuned for the *solo* general that fights level 1;
  `bossForLevel` then compounds hp/attack per level, which covers both the rising difficulty
  and the body the party gains each clear (levels 1–7 add one hero apiece).
- **Casting.** Drag a hero onto the target its ability's `targetKind` names — the boss or an
  ally. Role never gates it. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map.
- VFX: Phaser tweens/graphics only.
