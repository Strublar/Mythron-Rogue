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
    │   ├── heroes.ts                   # PARTY roster + the 3 archetype abilities + threat tuning
    │   └── bosses.ts                   # Boss definitions
    ├── engine/
    │   └── FightEngine.ts              # Real-time fight sim: cooldowns, auto-acts, casts
    └── game/
        ├── PhaserGame.ts               # Phaser.Game config (720×1280 portrait, FIT)
        ├── layout.ts                   # Slot coordinates, scales, bar/ground offsets
        ├── orientation.ts              # Portrait lock (Screen Orientation API + fullscreen)
        ├── UnitAnimator.ts             # UNIT_DEFS registry + atlas anim registration
        ├── CombatantView.ts            # Sprite + health bar + cooldown bar + ready ring + threat bar/aggro mark
        ├── ui.ts                       # Shared btn_confirm button factory
        ├── HealthBar.ts                # Reusable HP/shield bar (heroes and boss)
        ├── DragCastController.ts       # Drag-to-cast: arrow, target highlight, hit test
        └── scenes/
            ├── BootScene.ts            # Preloads unit atlases (from UNIT_DEFS) + backdrops
            ├── MainMenuScene.ts        # Title + FIGHT BOSS button
            ├── BossFightScene.ts       # Layout, engine ↔ view wiring, end overlay
            └── InterludeScene.ts       # Between-fights screen (next-boss briefing + CONTINUE)
```

## Data Flow

```
main.ts
  └── PhaserGame (canvas, 720×1280 portrait)
        BootScene → MainMenuScene → BossFightScene
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
  in `layout.ts` is the single source of slot positions.
- **Real-time, but the fight only starts on the first ability cast.** Until then every
  actor idles (`FightEngine.started`). Heroes then auto-attack (healers auto-heal the
  lowest-HP ally).
- **Threat.** Damage dealt and hp healed add threat, weighted per role
  (`ROLE_THREAT_MULTIPLIER`); the boss always swings at the highest-threat living hero.
  A tank ability is a taunt: it wipes party threat and plants `TAUNT_THREAT` on the caster.
- **Between fights.** A cleared boss pauses `BossFightScene` and launches `InterludeScene`;
  resuming the fight scene spawns the next boss.
- **Abilities** are cast by dragging a hero onto a target: boss for tanks/dps, an ally
  for healers. Rejected drops cost no cooldown.
- **Engine never touches sprites.** `FightEngine` emits `FightEvent`s; views react.
- **Atlas frames are untrimmed square canvases** of varying size that share one art
  scale — use the flat `HERO_SCALE` / `BOSS_SCALE`, never per-unit height normalisation.
- Adding a unit means adding its key to `UNIT_DEFS`; `BootScene` preloads from that map.
- VFX: Phaser tweens/graphics only.
