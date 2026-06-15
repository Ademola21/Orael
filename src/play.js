/* ========================================================================
   play.js — Play screen UI actions
   Wheel, scratch card, mystery chest, lottery, and leaderboard.
   All game outcomes come from the server — the client only animates.
   ======================================================================== */

import { api } from './api.js';
import { playAd } from './ads.js';
import { getState, updateState } from './state.js';
import { $, render, toast, reward, fmt, fmtInt } from './ui.js';
import { haptic } from './telegram.js';

/* ---- Wheel constants ---- */
const WHEEL_PRIZES = [100, 50, 250, 0, 30, 15, 500, 5];
const NUM_SEGMENTS = WHEEL_PRIZES.length;
const SEG_ANGLE    = 360 / NUM_SEGMENTS;

let wheelRot = 0;
let spinning = false;

/* ========================================================================
   BUILD WHEEL SVG
   ======================================================================== */

/**
 * Build the wheel SVG with 8 segments and copper accent text.
 * Must be called once on init.
 */
export function buildWheel() {
  const svg = $('wheel');
  if (!svg) return;

  const cx = 100, cy = 100, r = 100;
  let html = '';

  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const a0 = (i * SEG_ANGLE - 90) * Math.PI / 180;
    const a1 = ((i + 1) * SEG_ANGLE - 90) * Math.PI / 180;

    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);

    const fill = i % 2 === 0 ? '#241f1b' : '#2f2722';

    // Segment path
    html += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z" fill="${fill}" stroke="#3a312a" stroke-width="0.5"/>`;

    // Label text positioned at midpoint of segment
    const am = (a0 + a1) / 2;
    const tx = cx + r * 0.66 * Math.cos(am);
    const ty = cy + r * 0.66 * Math.sin(am);
    const label = WHEEL_PRIZES[i] === 0 ? '✕' : WHEEL_PRIZES[i];
    const rot = (i * SEG_ANGLE) + (SEG_ANGLE / 2);

    html += `<text x="${tx}" y="${ty}" fill="#e0a25b" font-size="13" font-family="Space Grotesk" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${tx} ${ty})">${label}</text>`;
  }

  svg.innerHTML = html;
}

/* ========================================================================
   WHEEL ANIMATION
   ======================================================================== */

/**
 * Animate the wheel to land on the server-provided prize index.
 * @param {number} prizeIndex — segment index (0-based)
 * @param {number} prizeAmount — ORL won
 */
function animateWheel(prizeIndex, prizeAmount) {
  if (spinning) return;
  spinning = true;

  const target = 360 * 5 + (360 - (prizeIndex * SEG_ANGLE + SEG_ANGLE / 2));
  wheelRot += target;

  const wheelEl = $('wheel');
  if (wheelEl) {
    wheelEl.style.transition = 'transform 4.5s cubic-bezier(0.12, 0.7, 0.12, 1)';
    wheelEl.style.transform = `rotate(${wheelRot}deg)`;
  }

  setTimeout(() => {
    spinning = false;
    if (wheelEl) wheelEl.style.transition = '';

    if (prizeAmount > 0) {
      reward(prizeAmount, 'Lucky spin!', 'Watch an ad to spin again!');
    } else {
      toast('So close', 'No win this time');
    }
    render();
  }, 4700);
}

/* ========================================================================
   SETUP PLAY ACTIONS
   ======================================================================== */

/**
 * Wire all Play screen event listeners.
 */
export function setupPlay() {

  /* ---- Spin ---- */
  const spinBtn = $('spinBtn');
  if (spinBtn) {
    spinBtn.addEventListener('click', () => {
      if (spinning) return;
      const S = getState();

      const doSpin = async () => {
        try {
          const res = await api('/api/play/spin', { method: 'POST' });
          updateState(res);
          animateWheel(res.prizeIndex ?? 0, res.prizeAmount ?? 0);
        } catch (e) { /* handled */ }
      };

      playAd('Loading spin…', 'Watch an ad to spin the wheel.', 10, doSpin);
    });
  }

  /* ---- Scratch card ---- */
  const scratchBtn = $('scratchBtn');
  if (scratchBtn) {
    scratchBtn.addEventListener('click', () => {
      const S = getState();
      if ((S.scratchLeft || 0) <= 0) {
        toast('No cards left', 'Come back tomorrow');
        return;
      }

      playAd('Loading card…', 'Scratch to reveal your prize.', 8, async () => {
        try {
          const res = await api('/api/play/scratch', { method: 'POST' });
          updateState(res);

          const prize = res.prizeAmount ?? 0;
          const card = $('scratch');
          if (card) {
            card.classList.remove('revealed');
            const prizeEl = $('scratchPrize');
            if (prizeEl) prizeEl.textContent = prize > 0 ? '+' + prize : '✕';

            card.onclick = () => {
              card.classList.add('revealed');
              card.onclick = null;
              if (prize > 0) {
                toast('Scratch win!', `+${prize} ORL`);
              } else {
                toast('No luck', 'Try the next one');
              }
              render();
            };
          }
          render();
        } catch (e) { /* handled */ }
      });
    });
  }

  /* ---- Mystery chest ---- */
  const chestBtn = $('chestBtn');
  if (chestBtn) {
    chestBtn.addEventListener('click', () => {
      playAd('Filling chest…', 'Each ad gets you closer to the loot.', 10, async () => {
        try {
          const res = await api('/api/play/chest', { method: 'POST' });
          updateState(res);

          if (res.chestOpened && res.prizeAmount) {
            reward(res.prizeAmount, 'Chest unlocked!', 'Big haul. Fill another one?');
          } else {
            const S = getState();
            toast('Chest filling', `${S.chestProgress || 0}/5`);
          }
          render();
        } catch (e) { /* handled */ }
      });
    });
  }

  /* ---- Lottery: free ticket (ad) ---- */
  const lottoAdBtn = $('lottoAdBtn');
  if (lottoAdBtn) {
    lottoAdBtn.addEventListener('click', () => {
      playAd('Loading ticket…', 'Watch to grab a free entry.', 10, async () => {
        try {
          const res = await api('/api/play/lottery/ticket', {
            method: 'POST',
            body: { type: 'ad' },
          });
          updateState(res);
          render();
          toast('Ticket added', 'Good luck tonight');
        } catch (e) { /* handled */ }
      });
    });
  }

  /* ---- Lottery: buy ticket ---- */
  const lottoBuyBtn = $('lottoBuyBtn');
  if (lottoBuyBtn) {
    lottoBuyBtn.addEventListener('click', async () => {
      const S = getState();
      if (S.balance < 500) {
        toast('Not enough ORL', 'Need 500');
        return;
      }

      try {
        const res = await api('/api/play/lottery/ticket', {
          method: 'POST',
          body: { type: 'buy' },
        });
        updateState(res);
        render();
        toast('Ticket bought', 'Entry confirmed');
      } catch (e) { /* handled */ }
    });
  }

  // Render leaderboard initially
  renderLeaderboard();
}

/* ========================================================================
   RENDER: LEADERBOARD
   ======================================================================== */

/**
 * Render the leaderboard from state.
 * @param {Array} [data] — leaderboard entries
 */
export function renderLeaderboard(data) {
  const el = $('leaderboard');
  if (!el) return;

  const S = getState();
  const entries = data || S.leaderboard || [];

  let rows = '';

  if (entries.length) {
    rows = entries.map((n, i) => {
      const name = n.first_name || n.name || 'Anonymous';
      const amt = n.balance !== undefined ? fmtInt(n.balance) : 0;
      const initial = name.replace('@', '')[0].toUpperCase();
      return `<div class="lb-row"><div class="lb-rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
        <div class="lb-av">${initial}</div>
        <div class="lb-name">${name}</div><div class="lb-amt">${amt} ORL</div></div>`;
    }).join('');
  } else {
    rows = `<div style="text-align:center;padding:20px;color:var(--ink-soft);font-size:13px">Leaderboard will update as users mine ORL.</div>`;
  }

  // Current user row
  const userInitial = S.firstName ? S.firstName[0].toUpperCase() : 'A';
  const rankStr = S._userRank ? S._userRank : '—';
  rows += `<div class="lb-row lb-me"><div class="lb-rank">${rankStr}</div><div class="lb-av" id="lbAv">${userInitial}</div>
    <div class="lb-name">You<small>climb to reach the prize pool</small></div><div class="lb-amt">${fmtInt(S.balance)} ORL</div></div>`;

  el.innerHTML = rows;
}
