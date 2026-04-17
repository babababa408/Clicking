# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mythic Idle — Tales of the Ancients** is a vanilla HTML/CSS/JS incremental/idle clicker game. No build step, no framework, no package manager — open `index.html` directly in a browser to run.

## Running the Game

```bash
# Open in browser directly (no server needed)
xdg-open index.html        # Linux
open index.html             # macOS
```

There are no tests, no linter, and no build tools configured.

## Architecture

Three files, no modules:

| File | Purpose |
|------|---------|
| `index.html` | DOM structure: HUD, click zone, tabbed upgrade area |
| `game.js` | All game state, logic, rendering, and event handling |
| `style.css` | Theming, animations, CSS variables |

### State & Data Flow

All game state lives in a single `state` object in `game.js`. The flow on every meaningful event:

1. **Click** → mutate `state.coins`/`state.gems` → `renderHUD()`
2. **Passive tick** (every 200ms) → `state.coins += state.coinsPerSec * delta` → `renderHUD()`
3. **Upgrade purchase** → deduct currency → `upgradeLevels[id]++` → `upgrade.effect(newLevel)` → `renderHUD()` + `renderAllUpgrades()`
4. **Ascension** → award `tokens` → reset coins/gems/non-prestige upgrades → `recalcStats()` → full re-render

`recalcStats()` resets derived stats to base values and replays all prestige upgrade effects. Call it whenever a prestige upgrade is purchased or after ascension.

### Currency System

- **Gold (`state.coins`)**: Earned per click + passive CPS; resets on ascension (10% retained via prestige unlock)
- **Mystic Runes (`state.gems`)**: RNG drop on click (`state.gemDropChance`, baseline 5%); resets on ascension
- **Divine Favor (`state.tokens`)**: Earned only via ascension; **never resets** — persists across all rebirths

### Upgrade System

Upgrades are defined as plain objects in three arrays: `COIN_UPGRADES`, `GEM_UPGRADES`, `PRESTIGE_UPGRADES`. Each entry shape:

```js
{
  id: 'unique_key',
  name: 'Display Name',
  icon: '🐉',
  desc: 'Tooltip text',
  maxLevel: 10,
  baseCost: 100,
  costMult: 1.5,       // cost = floor(baseCost * costMult^currentLevel)
  currency: 'coins',   // 'coins' | 'gems' | 'tokens'
  theme: 'yeti',       // drives CSS data-theme attribute for card color
  effect(level) { /* mutate state here */ }
}
```

Current levels are stored in `upgradeLevels[id]` (integer). `PRESTIGE_UPGRADES` levels persist across ascensions; the other two arrays reset.

### Underscore-prefixed State Flags

Internal/derived state uses an underscore prefix: `state._prestigeClickMult`, `state._gemCoinSync`, `state._bonusTokens`, etc. These are recalculated by `recalcStats()` — never mutate them directly outside of `effect()` callbacks.

## Key Conventions

- **Number formatting**: Use the existing `fmt(n)` helper — auto-scales to K/M/B/T with 1–2 decimal places.
- **DOM caching**: Cache element references at module top via `const $ = id => document.getElementById(id)`. Do not use repeated `querySelector` calls in hot paths.
- **Event delegation**: Upgrade button clicks are handled via a single delegated listener on `#upgrade-area` using `.closest('.buy-btn')`. Follow this pattern for new interactive elements in the upgrade area.
- **Section headers**: Use `/* ─── Section Title ──────────────────── */` style dividers to organize `game.js` sections.
- **Theming**: Cryptid/folklore names for upgrades (Yeti, Kraken, Thunderbird, etc.). New upgrades should follow this naming convention and have a corresponding `theme` class in `style.css`.
- **CSS variables**: Colors and spacing are driven by custom properties in `:root` (`--bg`, `--accent`, etc.). Prefer these over hardcoded values.
