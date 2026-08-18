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
    │   ├── statMath.ts                 # grow()/haste()/growHero() percent math + armor, crit, power math
    │   ├── boons.ts                    # Boon pool, roll, effect text, applyBoons — unused by the run loop
    │   ├── progression.ts              # Levels 1–10: per-level growth, exp curve, applyProgress
    │   ├── passives.ts                 # PASSIVES — one per hero, unlocked at level 5
    │   ├── orbs.ts                     # Rarity tiers/odds, orb price, dupe exp, runGold, rollOrb
    │   └── bosses.ts                   # SHADOWLORD + bossForDifficulty ladder scaling
    ├── engine/
    │   ├── FightEngine.ts              # Real-time fight sim: cooldowns, auto-acts, casts
    │   └── ProgressionStore.ts         # localStorage account: levels, owned, gold, team, maxDifficulty
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
            ├── MainMenuScene.ts        # Title + FIGHT BOSS + SHOP link
            ├── TeamScene.ts            # Between-runs page: 7 seats, difficulty stepper, owned-hero grid
            ├── ShopScene.ts            # Orb shop: gold, buy, rarity reveal, duplicate exp
            └── BossFightScene.ts       # Layout, engine ↔ view wiring, result overlay
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → TeamScene → BossFightScene → TeamScene
        TeamScene hands BossFightScene.init { team: HeroDef[7], difficulty }
        BossFightScene owns:
          FightEngine        (pure state; emits 'fight' FightEvents)
          CombatantView      (1 boss + the seven heroes)
          DragCastController (input → engine.castAbility)
        update(dt) → engine.tick(dt) → events → view animations
```

## Key Constraints

- **Portrait, mobile only.** 720×1280 base, `Scale.FIT`. Boss in the top half, the
  party's three rows in the bottom half.
- **Party:** exactly 7 heroes — 2 tanks (front), 3 dps (mid), 2 heals (back). `HERO_SLOTS` in
  `layout.ts` is the single source of slot positions; `PARTY_SEATS` names the seven seats in
  row order and `seatedSlots(seats)` hands slots to the filled ones. The team is a seat array
  in `AccountState.team`, so its index *is* its seat, in the store and on the battlefield.
- **The run loop.** `TeamScene` → `BossFightScene` → `TeamScene`. A run is **one boss**: the
  team is fixed for its whole length and never changes during it. A clear pays exp + gold and
  opens the next rung; a wipe pays nothing. Both outcomes offer RETRY (same team, same
  difficulty) and a way back to the team page.
- **The team is built between runs.** `TeamScene` is the only page besides the shop: the seven
  seats on top, the difficulty stepper above them, the owned heroes of the selected seat's role
  below. Seats are role-locked, so the *selected seat is the grid's filter* — no role tabs.
  Tapping a hero seats it (`setTeamSeat`, persisted immediately); tapping the seat's current
  occupant empties it. A hero seated elsewhere draws `IN PARTY` and is not pickable — free its
  seat first. FIGHT is disabled until all seven seats are filled.
- **Difficulty.** `AccountState.maxDifficulty` is the highest rung *unlocked* (so "best cleared"
  is one less). The stepper picks anything from 1 up to it; `recordClear(difficulty)` bumps it by
  one when a clear lands on the top rung. `bossForDifficulty(d)` compounds `SHADOWLORD`'s hp,
  attack and swing rate per rung. Base is tuned for a full seven at **level 1**, and the curve is
  deliberately gentle — the team only grows through account levels, so climbing means upgrading.
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
  archetype (`arcanyst`, `blade`, `golem`, `beast`, `blood`). They ride the roster card and the
  stats popup as the flavour axis a team can be built around; nothing mechanical reads them yet.
- **Trigger boons** *(machinery only — boons are not part of the run loop)*. A boon carries `effect` (permanent stats), `trigger` (a `BoonTriggerSpec`),
  or both. A trigger is `on` (fight event or `interval`) + `when` (scope gate, threshold,
  1-in-N, internal cooldown, once-per-fight) + `do` (boss damage, heal, shield, timed buff,
  dot, cooldown refund, stagger, taunt, free recast). Every engine state change leaves through
  `FightEngine.signal`, which emits the `FightEvent` and then walks the owned triggers;
  `runAction` resolves payloads through the ordinary primitives, so views animate them for
  free. Trigger payloads never wake other triggers (`firing` guard, one level deep). Owning a
  boon twice fires it twice — no percentage stacking. `setBoons` hands the engine the run's
  boons; per-fight counters are seeded when the engine is constructed.
- **Progression is the game.** Every hero carries an account-wide level (1–10) persisted in
  `localStorage` by `ProgressionStore`; `leveledRoster()` folds it in via `applyProgress` (base
  stats grown by `LEVEL_GROWTH × (level-1)`, plus the `PASSIVES` entry from `PASSIVE_LEVEL` (5)).
  `teamDefs()` resolves the seated team through it, so **a run fields leveled heroes with live
  passives** — that growth is the only thing that climbs the difficulty ladder. A cleared boss
  pays `runExp(difficulty)` to all seven (`grantRunExp`) and `runGold(difficulty)` to the purse
  (`grantRunGold`), both called from the victory overlay only.
- **Collection.** Heroes are *owned*, not given. A fresh account owns exactly the seven
  `DEFAULT_PARTY_IDS` — one legal 2/3/2, seated as the starting team — and `ownedRoster()` is
  what `TeamScene`'s grid draws, so an unowned hero can never be fielded. Each `HeroDef` carries a
  `rarity` (`B`/`A`/`S`, 10/7/3 heroes) which is pull weight and card tint only, never stats.
  A cleared boss also pays `runGold(difficulty)` — a flat base plus a per-rung bonus, so climbing
  funds faster. `ShopScene` spends it: `buyOrb()` deducts `ORB_PRICE`, draws
  a tier on `RARITY_WEIGHT` (70/25/5) then a hero uniformly inside it, and either unlocks that
  hero or — if already owned — pays it `DUPE_EXP` through the same `addExp` levels use, so no
  pull is dead and a complete collection keeps orbs worth buying. `ProgressionStore` remains the
  only writer; its key is `mythron.progression.v2` (`AccountState`), migrating a v1 blob's levels
  and seeding the starters. `team` and `maxDifficulty` are additive to that blob the way
  `prismatic` was — a save written before them reads the default seating and rung 1.
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
  level. Live in a run: `teamDefs()` fields leveled defs, so a level-5 hero's passive attaches.
- **Boons** are not part of the run loop. `src/data/boons.ts`, `BoonCard` and `BoonListPanel`
  are kept intact and unreferenced; the engine's trigger machinery still backs passives.
- **One fight per engine.** `FightEngine` is constructed with the team and its boss and lives
  for exactly that fight — there is no next-boss path. `BossFightScene.addHeroView` is the view
  side: sprite, bars, `DragCastController.register`, and the long-press probe, run once per seat
  at `create` (`this.team` arrives in seat order, so its index is its `seatSlot`).
- **The result overlay** is the run's only end state. It draws after `RESULT_DELAY_MS` so the
  boss death plays out, and it is the *only* place rewards are granted — a defeat draws the same
  overlay with a "no rewards" note. Both offer RETRY (`scene.start` on itself with the same
  `BossFightData`) beside CONTINUE / TEAM.
- **Casting.** Drag a hero onto the target its ability's `targetKind` names — the boss or an
  ally. Role never gates it. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map.
- VFX: Phaser tweens/graphics only.
