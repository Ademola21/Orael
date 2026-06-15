// ─────────────────────────────────────────────────────────────
//  Orael – Economy Constants (single source of truth)
// ─────────────────────────────────────────────────────────────

/** ORL → NGN exchange rate */
export const ORL_TO_NGN = 0.03;

/** ORL earned per full tank session */
export const TANK_ORL = 30;

/** Mining rig tiers — each successive rig shortens the session */
export const RIGS = [
  { name: 'Rig I',   sessionMin: 180, cost: 0 },
  { name: 'Rig II',  sessionMin: 150, cost: 5000 },
  { name: 'Rig III', sessionMin: 120, cost: 20000 },
  { name: 'Rig IV',  sessionMin: 90,  cost: 60000 },
  { name: 'Rig V',   sessionMin: 60,  cost: 150000 },
];

// ── Faucet ──────────────────────────────────────────────────
export const FAUCET_COOLDOWN = 60 * 60 * 1000;   // 1 hour in ms
export const FAUCET_REWARD   = 20;                // ORL per claim

// ── Lottery ─────────────────────────────────────────────────
export const LOTTO_TICKET_ORL = 500;

// ── Chest mini-game ─────────────────────────────────────────
export const CHEST_GOAL       = 5;    // chests needed to unlock reward
export const CHEST_REWARD_MIN = 100;
export const CHEST_REWARD_MAX = 150;

// ── Spin-the-wheel ──────────────────────────────────────────
export const WHEEL_PRIZES  = [100, 50, 250, 0, 30, 15, 500, 5];
export const WHEEL_WEIGHTS = [8, 14, 1.5, 22, 12, 18, 0.5, 24];

// ── Scratch card ────────────────────────────────────────────
export const SCRATCH_PRIZES  = [5, 15, 30, 60, 150, 0];
export const SCRATCH_WEIGHTS = [40, 30, 18, 8, 1, 3];

// ── Daily login streak ──────────────────────────────────────
export const STREAK_AMOUNTS = [50, 80, 120, 180, 260, 360, 600];



// ── Session duration ────────────────────────────────────────
export const SESSION_MS = 3 * 60 * 60 * 1000; // 3 hours in ms

// ── Referral programme ──────────────────────────────────────
export const REFERRAL_L1_PCT = 0.10; // 10 % of referee earnings
export const REFERRAL_L2_PCT = 0.03; //  3 % second-level

// ── Earn tasks ──────────────────────────────────────────────
export const TASKS = [
  { id: 't1', title: 'Watch a sponsored video', sub: '15s · rewarded ad', reward: 25, url: '' },
  { id: 't2', title: 'Visit partner offer',     sub: 'Open link · 10s',  reward: 20, url: 'https://yorubacinemax.xyz/partner' },
  { id: 't3', title: 'Daily quiz',              sub: 'Answer 1 question', reward: 20, url: 'https://yorubacinemax.xyz/quiz' },
];

export const FEATURED_TASKS = [
  { id: 'f1', title: 'Join Orael Bot',          sub: 'Open & start the bot', reward: 30, url: 'https://t.me/Orael_bot' },
  { id: 'f2', title: 'Follow Orael on X',        sub: 'Tap follow',           reward: 25, url: 'https://x.com/Orael_Network' },
  { id: 'f3', title: 'Subscribe Orael channel',  sub: 'Telegram',             reward: 25, url: 'https://t.me/Orael_Channel' },
];

// ── Tier Multipliers ────────────────────────────────────────
export const TIER_MULTIPLIERS = {
  1: 1.0,
  2: 1.1,
  3: 1.25,
  4: 1.5,
  5: 2.0
};

export function getTierMultiplier(tier) {
  return TIER_MULTIPLIERS[tier || 1] || 1.0;
}

// ── Pro / Boost Multipliers ──────────────────────────────────
export const PRO_MULTIPLIER = 2.0;
export const BOOST_MULTIPLIER = 1.2;


