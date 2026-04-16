/* ══════════════════════════════════════════════════════════════════
   MYTHIC IDLE — Tales of the Ancients
   Currencies:
     coins    – Gold          — earned every invocation + passive creatures
     gems     – Mystic Runes  — rare, RNG manifest on invocation
     tokens   – Divine Favor  — granted only through Ascension
   ══════════════════════════════════════════════════════════════════ */

// ─── State ─────────────────────────────────────────────────────────
const state = {
  coins:   0,
  gems:    0,
  tokens:  0,

  totalClicks:   0,   // invocations this cycle (resets on Ascension)
  allTimeClicks: 0,   // never resets
  rebirths:      0,

  // derived – recalculated whenever an upgrade is bought
  coinsPerClick:  1,
  coinsPerSec:    0,
  gemDropChance:  0.05,   // 5% base

  lastTick: Date.now(),
};

// ─── Ascension threshold ─────────────────────────────────────────────
// Base 10,000 invocations; scales ×1.5 with each Ascension.
// "Titan's Will" prestige upgrade reduces the base before scaling.
const REBIRTH_CLICKS = 10000;

// ─── Upgrade Definitions ────────────────────────────────────────────
// Each upgrade: { id, name, icon, desc, maxLevel, baseCost, costMult,
//                 effect(level) → applied to state,
//                 currency: 'coins' | 'gems' | 'tokens' }

// ── Gold Rites (spend Gold) ─────────────────────────────────────────
const COIN_UPGRADES = [
  {
    id: 'stronger_click',
    name: "Ogre's Might",
    icon: '👹',
    desc: "Channel the Ogre's brute strength. +2 Gold per invocation.",
    maxLevel: 50,
    baseCost: 10,
    costMult: 1.6,
    currency: 'coins',
    effect: (lvl) => { state.coinsPerClick += 2; },
  },
  {
    id: 'coin_magnet',
    name: "Leprechaun's Greed",
    icon: '🍀',
    desc: 'The cunning Leprechaun multiplies your golden haul. ×1.25 Gold per invocation.',
    maxLevel: 20,
    baseCost: 100,
    costMult: 2.2,
    currency: 'coins',
    effect: (lvl) => { state.coinsPerClick = Math.floor(state.coinsPerClick * 1.25); },
  },
  {
    id: 'auto_clicker',
    name: 'Brownie Servant',
    icon: '🧝',
    desc: 'A tireless Brownie toils unseen in your halls. +1 Gold/s.',
    maxLevel: 30,
    baseCost: 50,
    costMult: 1.8,
    currency: 'coins',
    effect: (lvl) => { state.coinsPerSec += 1; },
  },
  {
    id: 'coin_factory',
    name: "Dragon's Hoard",
    icon: '🐉',
    desc: 'An ancient Dragon amasses wealth without rest. +5 Gold/s.',
    maxLevel: 20,
    baseCost: 500,
    costMult: 2.0,
    currency: 'coins',
    effect: (lvl) => { state.coinsPerSec += 5; },
  },
  {
    id: 'golden_fingers',
    name: 'Midas Touch',
    icon: '👑',
    desc: "King Midas' curse becomes your greatest blessing. +10 Gold/s and +5 Gold per invocation.",
    maxLevel: 15,
    baseCost: 2500,
    costMult: 2.5,
    currency: 'coins',
    effect: (lvl) => { state.coinsPerSec += 10; state.coinsPerClick += 5; },
  },
  {
    id: 'coin_surge',
    name: "Odin's Fury",
    icon: '⚡',
    desc: "The Allfather's wrath surges through all your coffers. All Gold income ×1.5.",
    maxLevel: 10,
    baseCost: 10000,
    costMult: 3.5,
    currency: 'coins',
    effect: (lvl) => {
      state.coinsPerClick = Math.floor(state.coinsPerClick * 1.5);
      state.coinsPerSec   = Math.floor(state.coinsPerSec   * 1.5);
    },
  },
];

// ── Runic Secrets (spend Mystic Runes) ─────────────────────────────
const GEM_UPGRADES = [
  {
    id: 'lucky_strike',
    name: 'Fairy Blessing',
    icon: '🧚',
    desc: 'The fair folk bless each invocation with mystic runes. +2% Rune manifest chance.',
    maxLevel: 20,
    baseCost: 3,
    costMult: 1.7,
    currency: 'gems',
    effect: (lvl) => { state.gemDropChance = Math.min(state.gemDropChance + 0.02, 0.80); },
  },
  {
    id: 'gem_doubler',
    name: "Djinn's Bounty",
    icon: '🌀',
    desc: 'A wish-granting Djinn doubles your rune rewards. Runes manifest ×2.',
    maxLevel: 5,
    baseCost: 10,
    costMult: 3.0,
    currency: 'gems',
    effect: (lvl) => { state._gemMultiplier = (state._gemMultiplier || 1) * 2; },
  },
  {
    id: 'gem_insight',
    name: "Oracle's Vision",
    icon: '👁️',
    desc: "The Oracle's sight links your Runes to Gold power. +5 Gold per invocation per Rune owned.",
    maxLevel: 1,
    baseCost: 5,
    costMult: 1,
    currency: 'gems',
    effect: (lvl) => { state._gemCoinSync = true; },
  },
  {
    id: 'crystal_core',
    name: 'Phoenix Feather',
    icon: '🔥',
    desc: "A sacred Phoenix Feather amplifies mystic power. +10% Rune chance, +10 Gold/s.",
    maxLevel: 10,
    baseCost: 25,
    costMult: 2.2,
    currency: 'gems',
    effect: (lvl) => {
      state.gemDropChance = Math.min(state.gemDropChance + 0.10, 0.80);
      state.coinsPerSec  += 10;
    },
  },
  {
    id: 'prism_aura',
    name: "Dragon's Iris",
    icon: '🌈',
    desc: "Gaze into the Dragon's prismatic eye and double all power. All income ×2.",
    maxLevel: 5,
    baseCost: 100,
    costMult: 4.0,
    currency: 'gems',
    effect: (lvl) => {
      state.coinsPerClick = Math.floor(state.coinsPerClick * 2);
      state.coinsPerSec   = Math.floor(state.coinsPerSec   * 2);
    },
  },
];

// ── Divine Blessings (spend Divine Favor) ──────────────────────────
const PRESTIGE_UPGRADES = [
  {
    id: 'prestige_boost',
    name: 'Olympian Blood',
    icon: '🏛️',
    desc: 'Ichor of the gods flows through you. Start each Ascension with ×1.5 Gold per invocation.',
    maxLevel: 10,
    baseCost: 1,
    costMult: 2.0,
    currency: 'tokens',
    effect: (lvl) => { state._prestigeClickMult = (state._prestigeClickMult || 1) * 1.5; },
  },
  {
    id: 'gem_head_start',
    name: 'Fae Blessing',
    icon: '🍄',
    desc: 'The Fae whisper ancient luck at each rebirth. +3% Rune manifest chance on Ascension start.',
    maxLevel: 10,
    baseCost: 1,
    costMult: 1.8,
    currency: 'tokens',
    effect: (lvl) => { state._prestigeGemBonus = (state._prestigeGemBonus || 0) + 0.03; },
  },
  {
    id: 'token_tithe',
    name: 'Celestial Tribute',
    icon: '🌟',
    desc: 'Greater sacrifices yield more Divine Favor per Ascension. +1 extra Divine Favor per Ascension.',
    maxLevel: 5,
    baseCost: 3,
    costMult: 2.5,
    currency: 'tokens',
    effect: (lvl) => { state._bonusTokens = (state._bonusTokens || 0) + 1; },
  },
  {
    id: 'eternal_grind',
    name: "Titan's Will",
    icon: '🗿',
    desc: "The endurance of the Titans eases your Ascension burden. Reduce Ascension base by 1,000 invocations.",
    maxLevel: 8,
    baseCost: 2,
    costMult: 2.0,
    currency: 'tokens',
    effect: (lvl) => { state._rebirthReduction = (state._rebirthReduction || 0) + 1000; },
  },
  {
    id: 'legacy_coins',
    name: "Wyrm's Legacy",
    icon: '🐲',
    desc: 'An ancient Wyrm preserves a portion of your Gold across Ascensions. Keep 10% of Gold.',
    maxLevel: 5,
    baseCost: 5,
    costMult: 3.0,
    currency: 'tokens',
    effect: (lvl) => { state._legacyCoinPct = (state._legacyCoinPct || 0) + 0.10; },
  },
];

// ─── Runtime level tracking ──────────────────────────────────────────
const upgradeLevels = {};  // id → current level
[...COIN_UPGRADES, ...GEM_UPGRADES, ...PRESTIGE_UPGRADES].forEach(u => {
  upgradeLevels[u.id] = 0;
});

// ─── Helpers ─────────────────────────────────────────────────────────
function getCost(upgrade) {
  const lvl = upgradeLevels[upgrade.id];
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMult, lvl));
}

function fmt(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

function pct(p) { return (p * 100).toFixed(1) + '%'; }

function rebirthThreshold() {
  const base    = Math.max(500, REBIRTH_CLICKS - (state._rebirthReduction || 0));
  const scaling = Math.pow(1.5, state.rebirths);
  return Math.floor(base * scaling);
}

// ─── Recalculate derived stats from scratch ───────────────────────────
// Called after Ascension; upgrade effects re-apply from stored levels.
function recalcStats() {
  state.coinsPerClick = 1;
  state.coinsPerSec   = 0;
  state.gemDropChance = 0.05;
  delete state._gemMultiplier;
  delete state._gemCoinSync;

  // Apply prestige bonuses first (permanent across Ascensions)
  if (state._prestigeClickMult) {
    state.coinsPerClick = Math.floor(state.coinsPerClick * state._prestigeClickMult);
  }
  if (state._prestigeGemBonus) {
    state.gemDropChance = Math.min(state.gemDropChance + state._prestigeGemBonus, 0.80);
  }

  // Re-apply Gold Rite upgrades
  for (const u of COIN_UPGRADES) {
    const lvl = upgradeLevels[u.id];
    for (let i = 0; i < lvl; i++) u.effect(i + 1);
  }

  // Re-apply Runic Secret upgrades
  for (const u of GEM_UPGRADES) {
    const lvl = upgradeLevels[u.id];
    for (let i = 0; i < lvl; i++) u.effect(i + 1);
  }

  // Oracle's Vision: dynamic bonus based on current rune count
  if (state._gemCoinSync) {
    state.coinsPerClick += Math.floor(state.gems * 5);
  }
}

// ─── DOM references ───────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const elCoinCount         = $('coin-count');
const elGemCount          = $('gem-count');
const elTokenCount        = $('token-count');
const elCoinRate          = $('coin-rate');
const elGemChance         = $('gem-chance');
const elRebirthStatus     = $('rebirth-status');
const elTotalClicks       = $('total-clicks');
const elStatCPC           = $('stat-cpc');
const elStatGDC           = $('stat-gdc');
const elStatRebirths      = $('stat-rebirths');
const elFloats            = $('float-container');
const elMainBtn           = $('main-btn');
const elRebirthBtn        = $('rebirth-btn');
const elRebirthThreshLabel = $('rebirth-threshold-label');
const elRebirthReward     = $('rebirth-reward-preview');

// ─── Render HUD & stats ───────────────────────────────────────────────
function renderHUD() {
  elCoinCount.textContent   = fmt(state.coins);
  elGemCount.textContent    = fmt(state.gems);
  elTokenCount.textContent  = fmt(state.tokens);
  elCoinRate.textContent    = '+' + fmt(state.coinsPerSec) + '/s';
  elGemChance.textContent   = 'Manifest: ' + pct(state.gemDropChance);
  elTotalClicks.textContent = fmt(state.totalClicks);
  elStatCPC.textContent     = fmt(state.coinsPerClick);
  elStatGDC.textContent     = pct(state.gemDropChance);
  elStatRebirths.textContent = state.rebirths;

  const threshold = rebirthThreshold();
  elRebirthThreshLabel.textContent = ' / ' + fmt(threshold) + ' for Ascension';

  const favorOnAscend = 1 + Math.floor(state.rebirths / 2) + (state._bonusTokens || 0);
  elRebirthReward.textContent =
    'You will receive ' + favorOnAscend + ' Divine Favor upon Ascending.';

  const canAscend = state.totalClicks >= threshold;
  elRebirthBtn.disabled = !canAscend;
  elRebirthBtn.textContent = canAscend
    ? '🌅 Ascend! (' + fmt(threshold) + ' invocations reached)'
    : '🌅 Ascend (need ' + fmt(threshold) + ' invocations)';
  elRebirthStatus.textContent = canAscend ? 'Ready to Ascend!' : 'Ascension: locked';
}

// ─── Render upgrade list ─────────────────────────────────────────────
function renderUpgradeList(upgrades, containerId, cssClass, btnClass) {
  const container = $(containerId);
  container.innerHTML = '';

  for (const u of upgrades) {
    const lvl      = upgradeLevels[u.id];
    const maxed    = lvl >= u.maxLevel;
    const cost     = getCost(u);
    const balance  = u.currency === 'coins' ? state.coins
                   : u.currency === 'gems'  ? state.gems
                   :                          state.tokens;
    const canAfford = !maxed && balance >= cost;

    const card = document.createElement('div');
    card.className = `upgrade-card ${cssClass}` +
                     (maxed ? ' maxed' : canAfford ? ' affordable' : '');

    card.innerHTML = `
      <span class="upgrade-icon">${u.icon}</span>
      <div class="upgrade-body">
        <div class="upgrade-name">${u.name}</div>
        <div class="upgrade-desc">${u.desc}</div>
        <div class="upgrade-level">
          Rank <span>${lvl}</span> / ${u.maxLevel}
        </div>
      </div>
      <button class="buy-btn ${btnClass}" ${maxed || !canAfford ? 'disabled' : ''}
              data-id="${u.id}">
        ${maxed ? 'MASTERED' : fmt(cost) + ' ' + currencyIcon(u.currency)}
      </button>
    `;

    container.appendChild(card);
  }
}

function currencyIcon(c) {
  return c === 'coins' ? '🪙' : c === 'gems' ? '🔮' : '✨';
}

function renderAllUpgrades() {
  renderUpgradeList(COIN_UPGRADES,     'coin-upgrade-list',     'coin-card',     'coin-btn');
  renderUpgradeList(GEM_UPGRADES,      'gem-upgrade-list',      'gem-card',      'gem-btn');
  renderUpgradeList(PRESTIGE_UPGRADES, 'prestige-upgrade-list', 'prestige-card', 'prestige-btn');
}

// ─── Buy upgrade ─────────────────────────────────────────────────────
function buyUpgrade(upgradeId) {
  const all = [...COIN_UPGRADES, ...GEM_UPGRADES, ...PRESTIGE_UPGRADES];
  const u   = all.find(x => x.id === upgradeId);
  if (!u) return;

  const lvl  = upgradeLevels[u.id];
  if (lvl >= u.maxLevel) return;

  const cost = getCost(u);
  if (u.currency === 'coins'  && state.coins  < cost) return;
  if (u.currency === 'gems'   && state.gems   < cost) return;
  if (u.currency === 'tokens' && state.tokens < cost) return;

  if (u.currency === 'coins')  state.coins  -= cost;
  if (u.currency === 'gems')   state.gems   -= cost;
  if (u.currency === 'tokens') state.tokens -= cost;

  upgradeLevels[u.id]++;
  u.effect(upgradeLevels[u.id]);

  // Oracle's Vision is dynamic — recalc when rune count changes
  if (state._gemCoinSync) recalcStats();

  renderAllUpgrades();
  renderHUD();
}

// ─── Floating text ────────────────────────────────────────────────────
function spawnFloat(text, type, x, y) {
  const el = document.createElement('div');
  el.className = `float-text ${type}`;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  elFloats.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ─── Invocation handler ───────────────────────────────────────────────
elMainBtn.addEventListener('click', () => {
  state.coins += state.coinsPerClick;
  state.totalClicks++;
  state.allTimeClicks++;

  const rect     = elMainBtn.getBoundingClientRect();
  const zoneRect = elFloats.getBoundingClientRect();
  const cx = rect.left + rect.width  / 2 - zoneRect.left + (Math.random() * 40 - 20);
  const cy = rect.top  + rect.height / 2 - zoneRect.top  - 10;

  spawnFloat('+' + fmt(state.coinsPerClick) + ' 🪙', 'coin', cx, cy);

  // RNG Rune manifest
  if (Math.random() < state.gemDropChance) {
    const runeAmount = state._gemMultiplier || 1;
    state.gems += runeAmount;
    spawnFloat('+' + runeAmount + ' 🔮', 'gem', cx - 15, cy - 30);

    if (state._gemCoinSync) recalcStats();
  }

  renderHUD();
  renderAllUpgrades();
});

// ─── Ascension ───────────────────────────────────────────────────────
elRebirthBtn.addEventListener('click', () => {
  const threshold = rebirthThreshold();
  if (state.totalClicks < threshold) return;

  const favorEarned = 1 + Math.floor(state.rebirths / 2) + (state._bonusTokens || 0);
  const legacyGold  = Math.floor(state.coins * (state._legacyCoinPct || 0));

  state.rebirths++;
  state.tokens += favorEarned;

  // Reset cycle currencies
  state.coins       = legacyGold;
  state.gems        = 0;
  state.totalClicks = 0;

  // Reset Gold Rite and Runic Secret levels (Divine Blessings persist)
  for (const u of COIN_UPGRADES) upgradeLevels[u.id] = 0;
  for (const u of GEM_UPGRADES)  upgradeLevels[u.id] = 0;

  // Full stat recalc from scratch (Divine Blessing bonuses preserved in state._*)
  recalcStats();

  renderAllUpgrades();
  renderHUD();
});

// ─── Passive income tick ─────────────────────────────────────────────
function tick() {
  const now   = Date.now();
  const delta = (now - state.lastTick) / 1000;
  state.lastTick = now;

  if (state.coinsPerSec > 0) {
    state.coins += state.coinsPerSec * delta;
    renderHUD();
    renderAllUpgrades();
  }
}

setInterval(tick, 200);

// ─── Tab switching ────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  });
});

// ─── Delegated buy button clicks ─────────────────────────────────────
document.getElementById('upgrade-area').addEventListener('click', (e) => {
  const btn = e.target.closest('.buy-btn');
  if (btn && !btn.disabled) buyUpgrade(btn.dataset.id);
});

// ─── Initial render ───────────────────────────────────────────────────
recalcStats();
renderHUD();
renderAllUpgrades();
