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
│   └── extract-sprites.mjs             # npm run extract-sprites
└── src/
    ├── main.ts                         # Entry: boots Phaser, preloads Lato, registers sw
    ├── types/
    │   └── index.ts                    # ALL shared types/interfaces (source of truth)
    ├── data/
    │   ├── heroes.ts                   # ROSTER (20 heroes) + heroesByRole + DEFAULT_PARTY + threat tuning
    │   ├── abilities.ts                # One Ability per hero — the roster's identity
    │   ├── statMath.ts                 # grow()/haste() percent math, shared by boons and buffs
    │   ├── boons.ts                    # Boon pool, roll, effect text, applyBoons(party, boons)
    │   └── bosses.ts                   # Boss definitions
    ├── engine/
    │   ├── FightEngine.ts              # Real-time fight sim: cooldowns, auto-acts, casts
    │   └── RunState.ts                 # Run-long boons + the roster they derive
    └── game/
        ├── PhaserGame.ts               # Phaser.Game config (720×1280 portrait, FIT)
        ├── layout.ts                   # Slot coordinates, scales, bar/ground offsets
        ├── orientation.ts              # Portrait lock (Screen Orientation API + fullscreen)
        ├── UnitAnimator.ts             # UNIT_DEFS registry + atlas anim registration
        ├── CombatantView.ts            # Sprite + health bar + cooldown bar + ready ring + threat bar/aggro mark
        ├── ui.ts                       # Shared btn_confirm button factory
        ├── HealthBar.ts                # Reusable HP/shield bar (heroes and boss)
        ├── HeroTooltip.ts              # Long-press stats card: hero stats + ability text/values
        ├── HeroInspector.ts            # Shared long-press-to-inspect: timer, drag guard, slot probes
        ├── BoonCard.ts                 # Selectable boon offer card + shared boon palette
        ├── HeroCard.ts                 # Roster grid card: portrait, name, stat strip, tap/hold
        ├── BoonListPanel.ts            # "BOONS" overlay: every boon owned this run, stacked
        ├── DragCastController.ts       # Drag-to-cast: arrow, target highlight, hit test
        └── scenes/
            ├── BootScene.ts            # Preloads unit atlases (from UNIT_DEFS) + backdrops
            ├── MainMenuScene.ts        # Title + FIGHT BOSS button
            ├── CharacterSelectScene.ts # Pre-run party builder on the battlefield slots
            ├── BossFightScene.ts       # Layout, engine ↔ view wiring, end overlay
            └── InterludeScene.ts       # Between-fights boon draft in the boss zone (+ hero long-press probes)
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → CharacterSelectScene → BossFightScene
        CharacterSelectScene hands BossFightScene.init the chosen HeroDef[]
        BossFightScene owns:
          FightEngine        (pure state; emits 'fight' FightEvents)
          CombatantView × 8  (1 boss + 7 heroes)
          DragCastController (input → engine.castAbility)
        update(dt) → engine.tick(dt) → events → view animations
```

## Key Constraints

- **Portrait, mobile only.** 720×1280 base, `Scale.FIT`. Boss in the top half, the
  party's three rows in the bottom half.
- **Party:** 7 heroes — 2 tanks (front), 3 dps (mid), 2 heals (back). `HERO_SLOTS`
  in `layout.ts` is the single source of slot positions; `withSlots(defs)` hands them out.
- **Party selection.** `ROSTER` holds 20 heroes (5 tanks / 9 dps / 6 heals), each with its
  own stats and its own `Ability`. `CharacterSelectScene` seeds from `DEFAULT_PARTY`, draws
  the picks at their real `HERO_SLOTS`, and opens a role grid in the boss zone on tap. It
  passes the chosen `HeroDef[]` to `BossFightScene.init`, which feeds `new RunState(party)`.
  RETRY after a defeat returns here — a new run is a new party.
- **Abilities** are pure data (`src/data/abilities.ts`). Primitives the engine resolves:
  `damage`, `heal`, `partyHeal`, `selfHeal`, `selfShield`, `allyShield`, `taunt`,
  `lifestealPct`, `bossStunMs`, `executeBelowPct`/`executeBonus`, `threatFlat`, `dot`
  (bleeds the boss over time) and `buff` (timed `attackPct`/`attackSpeedPct` on
  self/ally/party). Adding a field means adding a line to `abilityEffects` in
  `HeroTooltip.ts` — that function is the only place ability copy is written.
- **Buffs vs boons.** Boons are permanent and bake into `HeroDef` via `applyBoons`; buffs
  are temporary and ride on `HeroState.buffs`, folded in by `heroAttack`/`heroInterval` at
  tick time. Both use `grow`/`haste` from `src/data/statMath.ts`.
- **Real-time, but the fight only starts on the first ability cast.** Until then every
  actor idles (`FightEngine.started`). Heroes then auto-attack (healers auto-heal the
  lowest-HP ally). During that idle window a long press on a hero opens its stats card;
  the first cast switches hero pointer-down back to drag-cast alone.
- **Threat.** Damage dealt and hp healed add threat, weighted per role
  (`ROLE_THREAT_MULTIPLIER`); the boss always swings at the highest-threat living hero.
  A tank ability is a taunt: it wipes party threat and plants `TAUNT_THREAT` on the caster.
- **Tags.** Every hero carries two `HeroTag`s — a faction (`lyonar` … `mercenary`) and an
  archetype (`arcanyst`, `blade`, `golem`, `beast`, `blood`). Tags are the synergy axis:
  each offer slot rolls a scope weighted by how often it occurs in the party
  (`scopeWeights`), then draws a boon of that scope, so 4 Magmar to 2 Arcanysts means
  twice the Magmar offers. `'party'` rides the same draw on a flat weight. Tag boons come
  in two shapes: flat, or `perMember` — percentages multiplied by how many heroes the
  scope covers, which is what rewards stacking a tag.
- **Boons.** `RunState` holds every boon picked this run; `applyBoons` re-derives the whole
  roster from the chosen party (never mutating it) and `FightEngine.startNextBoss` swaps the
  new defs in. Percentages are additive across stacks; speed/cooldown bonuses are haste
  (`ms / 1+pct`). `abilityPowerPct` scales every ability payload, dot damage included.
- **Between fights.** A cleared boss freezes `BossFightScene` (`frozen` stops the sim, input
  goes off) and launches `InterludeScene`, which offers 3 boons. The scene is *not* paused —
  a paused scene stops its UpdateList, and the party must keep idling under the boon window.
  Tapping an offer only selects it: the affected heroes get pulsing rings (scope resolved by
  `boonAffects`) and `CONFIRM` banks it, resuming the fight scene and spawning the next boss.
  A `BOONS` button under the back row lists the run's boons; it exists only in the interlude.
  The interlude draws no full-screen overlay — only a result window in the vacated boss zone —
  so the party rows stay visible. The frozen scene takes no input, so the interlude owns its
  own invisible probe zones over `HERO_SLOTS` (`HeroInspector.addProbes`).
- **Casting.** Drag a hero onto the target its ability's `targetKind` names — the boss or an
  ally. Role never gates it. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map.
- VFX: Phaser tweens/graphics only.
