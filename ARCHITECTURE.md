# ARCHITECTURE.md — Mythron

## File Map

```
/
├── index.html                      # HTML shell + #rotate-gate portrait fallback overlay
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.json               # PWA manifest (portrait, fullscreen)
│   ├── sw.js
│   └── resources/
│       ├── units/                  # {unit}.png + {unit}_atlas.json (+ original .plist)
│       ├── icons/                  # Spell/artifact icons; artifacts carry a generated _atlas.json
│       ├── maps/ scenes/ ui/ generals/ # static PNG/JPG backdrops and UI art
│       └── fonts/                  # Lato
├── scripts/
│   ├── plist-to-atlas.mjs          # Cocos2d .plist → Phaser JSON atlas
│   ├── batch-plist-to-atlas.mjs    # npm run plist-to-atlas
│   ├── extract-sprites.mjs         # npm run extract-sprites
│   ├── generate-unit-catalog.mjs   # npm run unit-catalog → docs/units/
│   ├── generate-spell-catalog.mjs  # npm run spell-catalog → docs/spells/ + docs/artifacts/
│   └── lib/plist.mjs               # Shared Cocos2d .plist frame reader
├── docs/
│   ├── units/                      # Generated sprite catalog, one .md per faction + thumbs/
│   ├── spells/                     # Generated spell catalog (icon + VFX), per faction + thumbs/
│   └── artifacts/                  # Generated artifact icon catalog, per faction + thumbs/
└── src/
    ├── main.ts                     # Entry: boots Phaser, preloads Lato, registers sw
    ├── types/
    │   └── index.ts                # ALL shared types/interfaces (source of truth)
    ├── data/
    │   ├── heroes.ts               # ROSTER (27) + STARTER_PARTY_IDS + RECRUIT_POOL + threat tuning
    │   ├── abilities.ts            # One Ability per hero — the roster's identity
    │   ├── statMath.ts             # grow()/haste()/growHero() + EFFECT_LABEL/effectParts + armor, crit, power math
    │   ├── boons.ts                # Boon pool, roll, effect text, applyBoons — unused by the run loop
    │   ├── passives.ts             # PASSIVES — one per hero, live from the moment it is fielded
    │   ├── rarity.ts               # Rarity label/colour/order + roll weight + SHOP_PRICE
    │   ├── artifacts.ts            # ARTIFACT_POOL (12) + equipArtifact — gear stats + one passive
    │   ├── heroDraft.ts            # rollRecruitOffers + rollShopOffers + rollArtifactOffers
    │   └── bosses.ts               # BOSS_LADDER (8) + bossForStage looping + goldForStage
    ├── engine/
    │   ├── FightEngine.ts          # Real-time fight sim: cooldowns, auto-acts, casts
    │   └── RunState.ts             # One run: seven seats, stage, purse. Nothing persists.
    └── game/
        ├── PhaserGame.ts           # Phaser.Game config (720×1280 portrait, FIT)
        ├── layout.ts               # Slot coordinates, PARTY_SEATS, scales, bar/ground offsets
        ├── orientation.ts          # Portrait lock (Screen Orientation API + fullscreen)
        ├── UnitAnimator.ts         # UNIT_DEFS registry + atlas anim registration
        ├── CombatantView.ts        # Sprite + health bar + mana bar + ready ring + threat bar/aggro mark
        ├── ui.ts                   # Shared btn_confirm button factory + scene backdrop/label
        ├── HealthBar.ts            # Reusable HP/shield bar (heroes and boss)
        ├── HeroTooltip.ts          # Long-press stats card: rarity, stat grid, artifact, passive, ability values
        ├── statDisplay.ts          # STAT_COLOR + heroStatRows: the one stat palette and row order
        ├── HeroInspector.ts        # Shared long-press-to-inspect: timer, drag guard, slot probes
        ├── BoonCard.ts             # Boon offer card — unused by the run loop, kept with boons.ts
        ├── OfferCard.ts            # Shared offer frame: rarity box, rarity label, price, locked dim
        ├── HeroCard.ts             # Hero offer: portrait, name, tag strip, stat strip, role accent
        ├── ArtifactCard.ts         # Artifact offer: animated icon, granted stats, passive text
        ├── ArtifactIcon.ts         # Artifact icon atlas keys + looping idle sprite
        ├── TabBar.ts               # Pill tab row — the shop's HEROES / ARTIFACTS switch
        ├── BoonListPanel.ts        # "BOONS" overlay — unused by the run loop, kept with boons.ts
        ├── PrismaticFx.ts          # Foil treatment — unused by the run loop, kept with PrismaticBurst
        ├── PrismaticBurst.ts       # Prismatic reveal flourish — unused by the run loop
        ├── DragCastController.ts   # Drag-to-cast: arrow, target highlight, hit test
        ├── SeatDragController.ts   # Drag an offer card onto a seat: target rings, drop test
        └── scenes/
            ├── BootScene.ts        # Preloads unit atlases (from UNIT_DEFS) + backdrops
            ├── MainMenuScene.ts    # Title + NEW RUN
            ├── InterludeScene.ts   # Between stages: free recruit, then the shop (heroes / artifacts tabs)
            └── BossFightScene.ts   # Layout, engine ↔ view wiring, result overlay
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → BossFightScene ⇄ InterludeScene
        MainMenuScene starts a run:  BossFightScene.init { run: new RunState() }
        A cleared stage:  BossFightScene → InterludeScene 'offer' → 'shop'
                          → run.advance() → BossFightScene (next boss)
        A wipe:           BossFightScene → MainMenuScene (the run is over)
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
  row order and `seatedSlots(seats)` hands slots to the filled ones. The team is the seat
  array in `RunState`, so its index *is* its seat, in the run and on the battlefield.
- **The run loop.** A run is a **chain of bosses**: `BossFightScene` → `InterludeScene`
  (`offer` then `shop`) → `BossFightScene`, stage after stage, until the party wipes. A wipe
  ends the run outright — there is no retry and nothing carries over, so the next run opens on
  the same starter seven. `RunState` holds the whole run: the seven seats, the stage number and
  the purse. Nothing is persisted; there is no account state, no save file, no localStorage.
- **Artifacts.** Gear bought in the shop's `ARTIFACTS` tab and dropped on any seat — one per
  character, a second buy replacing the first. An `ArtifactDef` carries a `BoonEffect` of
  percent stats and one `HeroPassive`. The gear rides the *seat*, not the body, so swapping the
  occupant hands it over. `RunState.party()` folds it in with `equipArtifact` (`growHero`, the
  same math boons use) and carries the def on `HeroDef.artifact`, so every caller — engine,
  cards, tooltip — reads one geared def. `FightEngine.rebuildTriggers` slots the artifact's
  passive next to the hero's own, owner-scoped, so a dead bearer's lies dormant just the same.
  Icons are the CC0 artifact art: `resources/icons/{iconKey}.png` + a generated `_atlas.json`
  (12 idle frames), preloaded by `BootScene` and looped by `ArtifactIcon`.
- **The team is drafted inside the run.** Every run opens on `STARTER_PARTY_IDS` — the seven
  rarity-`C` starters — seated in `PARTY_SEATS` order. `InterludeScene` runs twice per cleared
  boss: `offer` hands out one free recruit rolled by `rollRecruitOffers` (tag-anchored on a
  random seat, so a party leaning on a tag keeps drawing it), then `shop` sells up to three more
  rolled by `rollShopOffers` (rarity-weighted) at `SHOP_PRICE`, plus three artifacts rolled by
  `rollArtifactOffers` on a second tab. All of them work the same way: drag a card onto a seat —
  a hero **replaces** whoever sits there (its own row only), an artifact straps onto any seat. The party is always seven,
  so every pick is a swap — there is never a gap to fill.
- **The boss ladder.** `BOSS_LADDER` is eight hand-tuned `BossDef`s fought in stage order;
  `bossForStage(stage)` indexes it and, past the last rung, loops it with compounding hp and
  attack. Stage 1 is tuned for the starter seven, and every rung after it assumes one recruit
  and one shop buy more than the last — the team gains *bodies of higher rarity*, never levels.
- **Gold.** `goldForStage(stage)` is banked by the victory overlay and spent in that stage's
  shop. The purse rides `RunState` and dies with the run, so saving across a stage is the only
  way to reach an `S`.
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
  stats popup as the flavour axis a team can be built around, and `rollRecruitOffers` anchors
  the free offer on a seated hero's tag — the one place they are mechanical.
- **Trigger boons** *(machinery only — boons are not part of the run loop)*. A boon carries `effect` (permanent stats), `trigger` (a `BoonTriggerSpec`),
  or both. A trigger is `on` (fight event or `interval`) + `when` (scope gate, threshold,
  1-in-N, internal cooldown, once-per-fight) + `do` (boss damage, heal, shield, timed buff,
  dot, cooldown refund, stagger, taunt, free recast). Every engine state change leaves through
  `FightEngine.signal`, which emits the `FightEvent` and then walks the owned triggers;
  `runAction` resolves payloads through the ordinary primitives, so views animate them for
  free. Trigger payloads never wake other triggers (`firing` guard, one level deep). Owning a
  boon twice fires it twice — no percentage stacking. `setBoons` hands the engine the run's
  boons; per-fight counters are seeded when the engine is constructed.
- **The roster.** 27 `HeroDef`s in one list: the 20 recruitable ones and the 7 rarity-`C`
  starters. `rarity` (`C`/`B`/`A`/`S`) is shop price, roll weight and card tint — never stats.
  `RECRUIT_POOL` is everything above `C`, so a starter can be replaced but never offered back.
  There are no levels: `ROSTER` folds each hero's `PASSIVES` entry on at module load, so a hero
  fights exactly as its data reads, from stage 1.
- **Passives** ride the boon trigger machinery, owner-scoped: a `TriggerSlot` with `ownerId`
  only wakes on its owner's events, `'scope'` targets resolve to that hero alone, and a dead
  owner's passive lies dormant. Every hero fields its passive the moment it is seated — there
  is no unlock level, so `HeroTooltip` never draws a locked one.
- **Boons** are not part of the run loop. `src/data/boons.ts`, `BoonCard` and `BoonListPanel`
  are kept intact and unreferenced; the engine's trigger machinery still backs passives. The
  prismatic modules (`PrismaticFx`, `PrismaticBurst`) sit in the same drawer: nothing in a run
  grants a foil, so their art is no longer preloaded.
- **One fight per engine, one engine per stage.** `FightEngine` is constructed with the team
  and its boss and lives for exactly that fight; the next stage is a fresh `BossFightScene`, so
  the party enters every boss at full hp and mana. `addHeroView` is the view side: sprite, bars,
  `DragCastController.register`, and the long-press probe, run once per seat at `create`
  (`run.party()` arrives in seat order, so its index is its `seatSlot`).
- **The result overlay** ends every stage. It draws after `RESULT_DELAY_MS` so the boss death
  plays out, and it is the *only* place gold is granted. A clear shows the stage's payout and
  the purse behind one CONTINUE into the interlude; a wipe shows how far the run got behind one
  MENU. There is no retry — the run is the unit of play.
- **Casting.** Drag a hero onto the target its ability's `targetKind` names — the boss or an
  ally. Role never gates it. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Seat drags.** `SeatDragController` is the interlude's input: it drags a `HeroCard`
  container, rings only the seats matching the dragged hero's role, and reports the seat it
  landed on. It is deliberately separate from `DragCastController`, which hit-tests live
  `CombatantView`s and casts abilities. A drop anywhere else springs the card home, unpaid.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map. A few
  atlases name their animations differently (`hurt` for `hit`, `move` for `run`) — `FRAME_ALIASES`
  in `UnitAnimator.ts` maps them back onto the shared keys.
- VFX: Phaser tweens/graphics only.
