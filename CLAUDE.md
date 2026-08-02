# CLAUDE.md — Mythron-Rogue

## 🎮 Project

Mobile boss-fight game built on top of Duelyst's CC0 assets (units, UI, artwork).
Gameplay loop: a party of 7 heroes (2 tanks / 3 dps / 2 heals) fights a boss in real time.
Heroes auto-attack; the player drags a hero onto the boss (or onto an ally, for healers)
to cast its ability.
Solo offline only — no multiplayer, no server infra.

**Assets source:** `open-duelyst/duelyst` (CC0 — fully free, commercial use allowed, no attribution required)

---

## 🛠 Stack

| Layer | Tech |
|---|---|
| Game engine | Phaser 3 |
| Language | TypeScript |
| Bundler | Vite |
| CI/CD | GitHub Actions → Vercel (preview URL per PR) |
| Mobile | Browser-first (portrait), Capacitor for store packaging later |

---

## 🗂 Architecture

See `ARCHITECTURE.md` for all file paths. No blind exploration.

Key directories:
```
src/
  game/         # Phaser scenes, views, input controllers, layout
  engine/       # FightEngine: real-time sim (cooldowns, auto-acts, casts)
  data/         # Hero roster, abilities, boss definitions
  types/        # All shared types
  assets/       # Sprites, spritesheets (from open-duelyst CC0)
```

---

## 🚨 SURVIVAL RULES (Token Economy)

**Zero Blind Exploration:** No `find` or `ls -R`. Use `ARCHITECTURE.md` for paths.

**Atomic Reads:** Never read a file >200 lines in full. Always use `grep` or precise line ranges.

**No Synthesis:** Never generate a "Comprehensive Report" or architecture summary.

**Strike Plan:** Bullet list `(File | Action | Impact)`. No prose. Wait for validation before coding.

**Plan Mode Lock:** Stay in plan mode. No file edits until user says `ok`, `go`, or `accept`.

**Grep Ladder:** `files_with_matches` → `content (-C 3 max)` → `Read (targeted range)`. Never skip a step.

**Output Contract:** Before any Read, state: `"I need X to do Y."` If X is not precise, grep first.

**Diff-Only:** For modifications, show only impacted lines. Never rewrite a file >50 lines in full.

**No Verbosity:** No pleasantries, no summary of what you're about to do, no post-coding explanation.

**Avoid Duplication:** Extract shared logic into reusable utilities instead of copy-pasting.

**Atomic Task:** One task = one commit. No grouping refactor + feature + bugfix in the same session.

**Agent Isolation:** For tasks requiring exploration of >3 files, delegate research to a sub-agent.

---

## 🤖 Sub-Agent Output Contract

Include this block in any sub-agent prompt:

```
Rules (mandatory):
- No find/ls -R. Use ARCHITECTURE.md for paths.
- No full reads of files >200 lines. Use grep or targeted line ranges only.
- Grep Ladder: files_with_matches → content (-C 3 max) → Read (targeted range). Never skip a step.
- Output Contract: before any Read, state exactly "I need X to do Y". If X is not precise, grep first.
- Report in under 150 words. Return ONLY: bullet list of (file path | line range | one-line finding).
```

---

## 📐 Code Principles

**Type-First:** Always define Types/Interfaces before implementing logic.

**Simplicity First:** Minimum code that solves the problem. No speculative abstractions.

**Surgical Changes:** Touch only what's needed. Don't improve adjacent code.

**Modularity:** If a component/module exceeds 150-200 lines, propose extraction.

**Strict DRY:** Extract shared logic (e.g. `HealthBar` and `CombatantView` serve both heroes and bosses).

**Mobile-first:** Touch input via Phaser pointer API (unified mouse/touch). Drag targets must be finger-friendly. Test on mobile browser at every PR via Vercel preview URL.

---

## 🎯 Game Design Constraints

**Layout:** Portrait 720×1280, `Scale.FIT`. Boss top half, party bottom half in 3 rows
(2 tanks / 3 dps / 2 heals). All slot coordinates live in `src/game/layout.ts`.

**Timing:** Real-time. Every actor runs on its own cooldown; `FightEngine.tick(dt)` is
driven from the scene's `update`. No turns.

**Engine purity:** `FightEngine` holds state and emits `FightEvent`s. It never touches
sprites, tweens, or scenes — views subscribe and animate.

**Boss AI:** Auto-attack only. Targets a random living tank, spilling to the back rows
only once both tanks are dead.

**Input:** Drag a hero onto a target to cast. Tanks/dps target the boss, healers target
an ally. An invalid drop is a no-op and costs no cooldown.

**Heroes/abilities/bosses:** Plain TS data objects in `src/data/`. No switch/case factory.

**VFX:** Phaser tweens/graphics/particles only (no Cocos2d `.plist` assets). Simple
effects first, polish last.

---

## 🗣️ Communication Style

Respond like caveman. No articles. No filler words. No pleasantries. Short. Direct. Grunt-level brevity. Code speaks for itself. If asked for code, give code. No explain unless asked.

---

## 🗜 Compact Instructions

When compacting context, preserve:
- Current task description and Strike Plan
- All Types/Interfaces defined in the session
- File paths and line ranges already identified
- Decisions made (chosen approach, rejected alternatives)
- Current git branch name

Remove:
- Full contents of already-read, unmodified files
- Exploration results from completed sub-tasks
- Verbose error messages already resolved
