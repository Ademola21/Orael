# Orael — Telegram Mini App

AI mining faucet. Users trade attention (rewarded ads) for mining energy.
"Refuel-to-Mine" loop: a virtual engine mines ORL for 3 hours, then runs out
of fuel; one rewarded ad refuels it to 100%. Optional ad unlocks a 2× boost.

**Live:** https://ademola21.github.io/Orael/

## Design

"Engine room" language — warm near-black surfaces, a single machined-copper
accent, analog instrument gauge, tactile cards, fine grain. No neon, no rainbow
gradients. Built to read as premium fintech, not a casino tap-game.

## Files

- `index.html` — markup, three screens (Miner / Earn / Wallet), bottom nav
- `styles.css` — full design system (tokens at the top of the file)
- `app.js` — live mining simulation, gauge math, ad flow, localStorage state

The frontend runs standalone with a simulated economy so it feels real. State
persists in `localStorage`; mining accrues against wall-clock time.

## Going to production

This is the **frontend**. To make it real you need a backend that owns the
balance and verifies ad completions server-side (the business model's anti-cheat
section). Do not trust the client for balances.

### 1. Real rewarded ads (Adsgram)

In `app.js`, the `playAd()` function is a visual stub. Replace the reward path
with the Adsgram SDK:

```js
const AdController = window.Adsgram.init({ blockId: "YOUR_BLOCK_ID" });
AdController.show()
  .then(() => { /* ad watched in full → call your backend to credit fuel */ })
  .catch(() => { /* skipped or error → no reward */ });
```

Load the SDK in `index.html`:
```html
<script src="https://sad.adsgram.ai/js/sad.min.js"></script>
```

### 2. Server-side validation

On ad completion, send Adsgram's signed callback token to your backend. The
backend verifies it with Adsgram, then sets `mining_started_at` and credits
fuel. Earnings are computed server-side:
`earned = min(3h, now - started) * hashrate`.

### 3. Wire the screens to your API

Swap the `localStorage` state in `app.js` for fetches to your backend
(balance, refuel, boost, tasks, withdraw requests).

### 4. Register the Mini App

Create the bot with @BotFather → set the Mini App URL to your hosted build.
