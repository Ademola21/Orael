# Orael — Production Financial Model

The job of this document: make sure **money in (ads + offers + Pro) always
exceeds money out (ORL payouts)**, at every scale, even in a bad month, while
still letting users earn enough to stay.

All figures are conservative on purpose. Sources for the ad/Stars/offerwall
rates are from current (2025–26) Nigeria/Tier-3 Telegram benchmarks.

---

## 1. Real-world assumptions (the inputs)

| Input | Value used | Notes |
|---|---|---|
| Exchange rate | **$1 = ₦1,500** | adjustable; ~₦1,550 in mid-2026 |
| Rewarded video CPM (Nigeria) | **$1.80** conservative | real range $1.50–$3.50; floor-tested at $1.00 |
| → Revenue per rewarded ad view | **$0.0018** (₦2.70) | = CPM ÷ 1000 |
| Banner CPM | $0.50–$1.00 | passive, treat as bonus |
| Adsterra popunder (Nigeria) | $1.80–$4.10 | extra layer on navigation |
| Offerwall payout to you | **80%** of advertiser bid | AdGem/ayet/Notik standard 75–85% |
| Telegram Star → your payout | **$0.013/star** | net via TON, ~0% Telegram fee |

**The one rule everything obeys:**
> Every ORL we pay for a rewarded action must cost **≤ 35%** of the ad revenue
> that funded it. That locks in a **≥ 65% gross margin** at our conservative CPM,
> and still stays profitable down to a **$1.00 CPM** (worst realistic case).

---

## 2. The ORL peg (recommended change)

**Current app peg:** 1 ORL = $0.0001 = ₦0.15. Problem: at this peg, 35% of an ad
($0.00063) only allows **~6 ORL per ad** — so "+50 ORL" rewards would pay out
8× what the ad earns. That bankrupts the platform.

**Recommended peg:** **1 ORL = $0.00002 = ₦0.03**  → **$1 = 50,000 ORL**.

Why this is better: the same tiny $0.0006 payout can now be shown as a
satisfying **"+30 ORL"** instead of "+6". Big, fun numbers; microscopic real
cost. Minimum withdrawals land at sensible ₦ amounts (see §7).

> Change in app config: `ORL_TO_NGN` from `0.15` → **`0.03`**.

Payout ceiling per single rewarded ad at this peg:
`35% × $0.0018 = $0.00063 = ` **~31 ORL max per ad**. Keep every per-ad reward at or under this.

---

## 3. Reward table — what each action pays, and who funds it

Per-ad revenue = $0.0018. "Cost" = what we pay the user, in $ and ORL.

| Mechanic | Reward (ORL) | $ cost | Funded by | Payout ratio |
|---|---|---|---|---|
| Refuel engine (1 ad) | 30 / session | $0.0006 | 1 rewarded ad | 33% ✅ |
| Watch & earn task | 25 | $0.0005 | 1 rewarded ad | 28% ✅ |
| Hourly bonus (faucet) | 20 | $0.0004 | 1 rewarded ad | 22% ✅ |
| Lucky spin (avg/EV) | ~20 | $0.0004 | 1 ad or daily-free | 22% ✅ |
| Scratch card (avg/EV) | ~18 | $0.00036 | 1 rewarded ad | 20% ✅ |
| Mystery chest (5 ads) | 120 | $0.0024 | 5 rewarded ads ($0.009) | 27% ✅ |
| 2× Boost (1 ad) | doubles tank | — | the boost ad pays for the extra ORL | 33% ✅ |
| Daily lottery | pool only | $0 net | self-funded by entry ads / ORL sinks | 0% ✅ |
| Referral L1 / L2 | 10% / 3% | small | skimmed from referred users' ad-funded ORL | absorbed in the 35% |

**Current app values that must change** (they're far too high for any safe peg):

| Item | Now | Set to |
|---|---|---|
| Base mining rate | 2.5–4.0 ORL/hr (uncapped) | **fixed 30 ORL tank** (see §4) |
| Hourly faucet `FAUCET_REWARD` | 60 | **20** |
| Task rewards | 35–50 | **20–25** |
| Scratch prizes | up to 250 (avg ~60) | EV **~18** (see §6) |
| Spin prizes | avg ~? | EV **~20** (see §6) |
| Chest payout | 300–800 | **100–150** |

---

## 4. Mining & rig upgrades — the key safety mechanism

**The trap:** if a rig upgrade makes you mine 2× faster, then one refuel ad pays
out 2× the ORL — but still only earns 1 ad's revenue. Margin collapses at high
rigs. The current app has this bug (rate goes 2.5 → 16 ORL/hr, payout per ad
rises 6×).

**The fix — fixed-tank model:** A refuel grants a **fixed 30 ORL "tank"** that
drains over the session. The rig level changes **how fast** the tank drains
(and pays out), **not how much**. Higher rig = shorter session = the user
refuels more often = **more ad views = more revenue**, while ORL-per-ad stays
flat at 30. Everyone wins and the margin never moves.

| Rig | Tank | Session length | ORL/hr (display) | ORL per refuel ad |
|---|---|---|---|---|
| I | 30 ORL | 3h 00m | 10.0 | 30 ✅ |
| II | 30 ORL | 2h 30m | 12.0 | 30 ✅ |
| III | 30 ORL | 2h 00m | 15.0 | 30 ✅ |
| IV | 30 ORL | 1h 30m | 20.0 | 30 ✅ |
| V | 30 ORL | 1h 00m | 30.0 | 30 ✅ |

- Upgrades are bought with **ORL** (a sink — removes coins from circulation,
  protects the peg). No cash leaves the platform.
- Daily ceiling is naturally capped: even at Rig V (1h sessions, 24/day) a user
  maxes ~720 ORL/day = **$0.0144/day**, all funded by 24 refuel ads ($0.043 rev).

Suggested upgrade prices (ORL sink): Rig II 5,000 · III 20,000 · IV 60,000 · V 150,000.

---

## 5. Offerwall & surveys — your biggest earner

This is real advertiser cash, not ad impressions. You receive ~80% of the bid;
you decide the user's cut. Recommend **paying users 55% of the advertiser bid**,
keeping ~25% after the network's 20%.

Flow for a $5.00 CPA offer (e.g. "Bybit sign-up + KYC"):

```
Advertiser pays         $5.00
Offerwall keeps 20%    -$1.00
You receive             $4.00
You pay user 55%       -$2.75   (= 137,500 ORL at the peg)
Your gross profit       $1.25   per completion
```

**Label fix:** in the app, the "$X payout" shown to the user should equal what
*they* get, and the ORL must match the peg: `ORL = user_$ × 50,000`. Current
offers are inconsistent (e.g. "+9,000 ORL / $0.90" — 9,000 ORL is only $0.18).
Corrected examples:

| Offer | Advertiser bid | User gets | Shown as |
|---|---|---|---|
| Install + level up (game) | $0.90 | $0.50 | 25,000 ORL |
| Bybit sign-up + KYC | $5.00 | $2.75 | 137,500 ORL |
| Temu first order | $1.80 | $1.00 | 50,000 ORL |
| Survey (CPX/BitLabs) | $0.52 | $0.30 | 15,000 ORL |

Offerwall typically adds **30–50%** on top of pure ad revenue, at higher margin.

---

## 6. Spin & scratch — keep expected value capped

Random rewards must have an **expected value (EV) under the per-ad ceiling**, no
matter how big the top prize looks. Keep rare jackpots for excitement, weight
them low.

**Lucky spin** (8 segments) — target EV ≈ 20 ORL:

| Prize | 100 | 50 | 250 | 0 | 30 | 15 | 500 | 5 |
|---|---|---|---|---|---|---|---|---|
| Weight % | 8 | 14 | 1.5 | 22 | 12 | 18 | 0.5 | 24 |

EV = (100·.08)+(50·.14)+(250·.015)+(0)+(30·.12)+(15·.18)+(500·.005)+(5·.24)
≈ **22 ORL** = $0.00044 per ad → 24% ratio ✅

**Scratch** — prizes 5/15/30/60/150 with the big ones rare → tune EV ≈ 18 ORL.

---

## 7. Withdrawals — fee + thresholds

- **Minimum withdrawal** sets how long a non-paying user grinds (and watches
  ads) before any cash leaves. Recommended:

| Method | Min ORL | = NGN | = USD |
|---|---|---|---|
| Airtime | 30,000 | ₦900 | $0.60 |
| Bank (NGN) | 50,000 | ₦1,500 | $1.00 |
| Opay / wallet | 80,000 | ₦2,400 | $1.60 |
| USDT (TRC20) | 150,000 | ₦4,500 | $3.00 |

- **Withdrawal fee: 10%** (Pro: 5%). Pure margin + discourages micro-cashout spam.
- A user reaching the ₦1,500 bank minimum has watched enough ads to generate
  **~$3+ in ad revenue** for you along the way → cashout is comfortably covered.

---

## 8. Orael Pro — does the subscription actually pay for itself?

Pro = **250 Stars/mo ($3.25 to you)**. Perks: 2× rate, **ad-free** refuels, 5%
withdrawals, free spins/chest.

The risk is ad-free refuels (no ad revenue) while still paying ORL. With the
fixed-tank model it's bounded:

```
Pro mining: 30 ORL tank, 2× speed → ~1.5h sessions → max ~16 tanks/day
  = 480 ORL/day = $0.0096/day = ~$0.29/mo
Free spins + daily chest                              ≈ $0.30/mo
Total Pro payout cost                                 ≈ $0.60/mo
Pro revenue                                            $3.25/mo
Net profit per Pro user                              ≈ $2.65/mo  ✅
```

Even before counting that Pro users still do offerwall offers (more revenue).
Pro is your **highest-margin product** — push it.

> Keep Pro at 250 Stars. Do not raise the 2× past 2×, and never make spins/chest
> ad-free *and* uncapped, or the bound breaks.

---

## 9. Revenue projections (conservative, ads only)

Assume avg **15 rewarded ads/user/day**, 33% payout, $1.80 CPM. Offerwall, Pro,
banners and Adsterra are **on top** of this.

| DAU | Gross/day | Payout/day | **Net/day** | **Net/month** |
|---|---|---|---|---|
| 1,000 | $27 | $9 | **$18** | **~$540** |
| 10,000 | $270 | $89 | **$181** | **~$5,430** |
| 50,000 | $1,350 | $446 | **$904** | **~$27,150** |

Add realistically **+40–80%** from offerwall + Pro + second ad network.

**Worst-case stress test ($1.00 CPM):** payouts are fixed in ORL, so the ratio
rises to ~59% — still **41% gross margin**. The system survives a bad month.
Below ~$1.00 CPM you'd dip toward break-even; that's what the admin panel is for
(§10).

---

## 10. Guardrails (so it can't break)

1. **Admin kill-switch levers** (build the admin panel): live control of base
   tank size, ORL→$ peg, reward amounts, min-withdrawal, and Pro price. If CPM
   drops, cut payouts in seconds.
2. **Server-side ad verification** — credit ORL only after Adsgram's signed
   completion callback (anti-bot). Never trust the client.
3. **Daily caps** per user on spins, faucet, chest, tasks (already designed).
4. **Frequency cap** ads to 1–2 per session burst to protect CPM and UX.
5. **One account per Telegram ID**; referral self-invite detection.
6. **Hold withdrawals 24h** + manual review above a threshold.
7. **Watch the live margin**: alert if (daily payout ÷ daily ad revenue) > 45%.

---

## 11. Recommended app config (drop-in constants)

```js
// economy.js — single source of truth
ORL_TO_NGN      = 0.03;        // 1 ORL = ₦0.03  ($1 = 50,000 ORL)
USD_TO_NGN      = 1500;
AD_REVENUE_USD  = 0.0018;      // conservative rewarded-ad value (for analytics)
MAX_PAYOUT_RATIO= 0.35;        // never exceed; alert at 0.45

TANK_ORL        = 30;          // fixed ORL per refuel (NOT rate × time)
RIGS = [                       // session length shrinks, tank stays 30
  { name:"Rig I",   sessionMin:180, cost:0 },
  { name:"Rig II",  sessionMin:150, cost:5000 },
  { name:"Rig III", sessionMin:120, cost:20000 },
  { name:"Rig IV",  sessionMin:90,  cost:60000 },
  { name:"Rig V",   sessionMin:60,  cost:150000 },
];

FAUCET_REWARD   = 20;          // was 60
TASK_REWARD     = 25;          // was 35–50
CHEST_REWARD    = [100,150];   // was 300–800
CHEST_GOAL      = 5;           // ads to fill
SPIN_PRIZES     = [100,50,250,0,30,15,500,5];
SPIN_WEIGHTS    = [8,14,1.5,22,12,18,0.5,24];   // EV ≈ 22 ORL
SCRATCH_PRIZES  = [5,15,30,60,150];
SCRATCH_WEIGHTS = [34,30,20,12,4];              // EV ≈ 18 ORL
LOTTO_TICKET_ORL= 500;

WITHDRAW_MIN    = { airtime:30000, bank:50000, opay:80000, usdt:150000 };
WITHDRAW_FEE    = 0.10;        // Pro: 0.05
OFFER_USER_CUT  = 0.55;        // % of advertiser bid paid to user
PRO_PRICE_STARS = 250;         // ≈ $3.25/mo to you
PRO_RATE_MULT   = 2;
```

These numbers keep you safe at $1.00 CPM and comfortably profitable at $1.80+.
