/* ========================================================================
   earn.js — Earn screen UI actions
   Tasks, featured tasks, offers (coming soon), surveys (coming soon),
   daily streak, live feed, faucet, and referral buttons.
   ======================================================================== */

import { api } from './api.js';
import { playAd } from './ads.js';
import { getState, updateState, setLocal } from './state.js';
import { $, render, toast, reward, fmt, fmtInt, naira } from './ui.js';
import { haptic, shareLink, openLink } from './telegram.js';

/* ---- SVG icon constants ---- */
const icoPlay = `<svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="#e0a25b"/></svg>`;
const icoStar = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.5 6 .5-4.5 4 1.4 5.9L12 16.8 6.6 18.9 8 13 3.5 9l6-.5L12 3z" fill="#e0a25b"/></svg>`;
const icoApp = `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`;
const icoSurvey = `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const icoDroid = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 9h10v7a1 1 0 0 1-1 1h-1v3h-2v-3h-2v3H9v-3H8a1 1 0 0 1-1-1V9zm-2 .5a1 1 0 0 1 2 0v5a1 1 0 0 1-2 0v-5zm12 0a1 1 0 0 1 2 0v5a1 1 0 0 1-2 0v-5zM8 8a4 4 0 0 1 8 0H8z"/></svg>`;

/* ---- Static data (fallbacks are empty arrays to ensure no mock data shows) ---- */
const DEFAULT_TASKS = [];
const DEFAULT_FEATURED = [];

const STREAK_AMOUNTS = [50, 80, 120, 180, 260, 360, 600];

let liveTimer = null;

/* ---- Helpers ---- */

function chipFor(done, label) {
  return `<div class="chip-go">${done ? 'Done' : label}</div>`;
}

function comingSoonChip() {
  return `<div class="chip-go" style="opacity:0.5;font-size:11px">Coming soon</div>`;
}

/* ========================================================================
   RENDER FUNCTIONS
   ======================================================================== */

export function renderTasks() {
  const S = getState();
  const tasks = S.tasks && S.tasks.length ? S.tasks : [];
  const featured = S.featuredTasks && S.featuredTasks.length ? S.featuredTasks : [];
  const completed = S.completedTasks || {};
  const completedFeat = S.completedTasks || {};

  // Tasks list
  const taskListEl = $('taskList');
  if (taskListEl) {
    if (tasks.length) {
      taskListEl.innerHTML = tasks.map(t => `
        <div class="item ${completed[t.id] ? 'done' : ''}" data-kind="tasks" data-id="${t.id}" data-r="${t.r}" data-url="${t.url || ''}">
          <div class="item-ic">${icoPlay}</div>
          <div class="item-body"><div class="item-title">${t.title}</div><div class="item-sub">${t.sub}</div></div>
          ${chipFor(completed[t.id], '+' + t.r + ' ORL')}</div>`).join('');
    } else {
      taskListEl.innerHTML = `<div style="text-align:center;padding:15px;color:var(--ink-soft);font-size:13px">Loading tasks...</div>`;
    }
  }

  // Featured list
  const featListEl = $('featuredList');
  if (featListEl) {
    if (featured.length) {
      featListEl.innerHTML = featured.map(t => `
        <div class="item featured ${completedFeat[t.id] ? 'done' : ''}" data-kind="featured" data-id="${t.id}" data-r="${t.r}" data-url="${t.url || ''}">
          <div class="item-ic">${icoStar}</div>
          <div class="item-body"><div class="item-title">${t.title}</div><div class="item-sub">${t.sub}</div></div>
          ${chipFor(completedFeat[t.id], '+' + t.r + ' ORL')}</div>`).join('');
    } else {
      featListEl.innerHTML = `<div style="text-align:center;padding:15px;color:var(--ink-soft);font-size:13px">Loading featured tasks...</div>`;
    }
  }

  // Wire click handlers
  document.querySelectorAll('[data-kind="tasks"], [data-kind="featured"]').forEach(el => {
    el.addEventListener('click', () => {
      const { kind, id, url } = el.dataset;
      const r = parseInt(el.dataset.r);
      const S = getState();
      const completedMap = S.completedTasks || {};
      if (completedMap[id]) return;

      if (url) {
        openLink(url);
      }

      const label = 'Verifying task…';
      playAd(label, 'Reward credits when you complete it.', 10, async () => {
        try {
          const res = await api('/api/earn/task', {
            method: 'POST',
            body: { taskId: id, kind },
          });
          updateState(res);
          renderTasks();
          render();
          reward(r, 'Reward earned', 'Nice. Keep stacking ORL.');
        } catch (e) { /* handled */ }
      });
    });
  });
}

function renderOffers() {
  const offerListEl = $('offerList');
  if (offerListEl) {
    offerListEl.innerHTML = `
      <div class="card" style="text-align:center;padding:24px 16px;background:rgba(224,162,91,0.02);border:1px dashed rgba(224,162,91,0.15);margin:10px 0">
        <div style="font-size:13px;color:var(--ink-soft)">Offerwall tasks will be loaded dynamically from partner networks (AdGate, Timewall) upon official launch.</div>
      </div>
    `;
  }

  const surveyListEl = $('surveyList');
  if (surveyListEl) {
    surveyListEl.innerHTML = `
      <div class="card" style="text-align:center;padding:24px 16px;background:rgba(224,162,91,0.02);border:1px dashed rgba(224,162,91,0.15);margin:10px 0">
        <div style="font-size:13px;color:var(--ink-soft)">Paid surveys from CPX Research and BitLabs will be available soon.</div>
      </div>
    `;
  }
}

function renderFeaturedOffers() {
  const el = $('featuredOffers');
  if (el) {
    el.innerHTML = `
      <div style="font-size:12px;color:var(--ink-soft);padding:10px;text-align:center;width:100%">Featured high-payout games coming soon.</div>
    `;
  }
}

function renderPartners() {
  const el = $('offerPartners');
  if (el) {
    el.innerHTML = `
      <div style="font-size:12px;color:var(--ink-soft);padding:10px;text-align:center;width:100%">Timewall, AyetStudios, AdGate, BitLabs.</div>
    `;
  }
}

export function renderStreak() {
  const S = getState();
  const el = $('streakStrip');
  if (!el) return;

  el.innerHTML = STREAK_AMOUNTS.map((a, i) => {
    const day = i + 1;
    const isClaimed = day < S.streakDay || (day === S.streakDay && S.streakClaimedToday);
    const isToday = day === S.streakDay && !S.streakClaimedToday;
    const cls = isClaimed ? 'claimed' : isToday ? 'today' : '';
    return `<div class="day ${cls}" ${isToday ? 'id="streakClaim"' : ''}><div>D${day}</div><div class="d-amt">${a}</div></div>`;
  }).join('');

  const claimEl = $('streakClaim');
  if (claimEl) {
    claimEl.addEventListener('click', async () => {
      try {
        haptic('light');
        const res = await api('/api/earn/streak', { method: 'POST' });
        updateState(res.user);
        render();
        renderStreak();
        toast('Daily streak claimed', `+${STREAK_AMOUNTS[S.streakDay - 1]} ORL`);
      } catch (e) { /* handled */ }
    });
  }
}

function setupOfferFilters() {
  document.querySelectorAll('#offerFilters .fpill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#offerFilters .fpill').forEach(x => x.classList.remove('on'));
      p.classList.add('on');
      setLocal('_offerFilter', p.dataset.f);
      renderOffers();
    });
  });
}

/* ---- Live feed simulation ---- */

function startLiveFeed() {
  const feed = $('liveFeed');
  if (!feed) return;
  feed.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);text-align:center;padding:15px 0">Live completions will appear once offerwalls are active.</div>`;
}

/* ========================================================================
   FAUCET + REFERRAL
   ======================================================================== */

function setupFaucet() {
  const faucetBtn = $('faucetBtn');
  if (!faucetBtn) return;

  faucetBtn.addEventListener('click', () => {
    const S = getState();
    const elapsed = Date.now() - (S.faucetLast || 0);
    if (elapsed < 60 * 60 * 1000) return;

    playAd('Claiming bonus…', 'Your hourly drip is loading.', 10, async () => {
      try {
        const res = await api('/api/earn/faucet', { method: 'POST' });
        updateState(res);
        render();
        toast('Hourly bonus', `+${res.reward || 20} ORL`);
      } catch (e) { /* handled */ }
    });
  });
}

function setupReferral() {
  const copyBtn = $('copyRef');
  const shareBtn = $('shareRef');
  const refCodeEl = $('refCode');

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const code = refCodeEl?.textContent || '';
      navigator.clipboard?.writeText(code);
      toast('Invite link copied', 'Share it anywhere');
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const code = refCodeEl?.textContent || '';
      const url = code.startsWith('http') ? code : 'https://' + code;
      shareLink(url, 'Mine ORL free on Orael ⛏️');
      toast('Link shared', '');
    });
  }
}

/* ========================================================================
   ADSGRAM TASKS
   ======================================================================== */

function renderAdsgramTasks() {
  const container = $('adsgramTaskList');
  if (!container) return;

  const blockId = import.meta.env.VITE_ADSGRAM_TASK_BLOCK_ID;
  if (!blockId) {
    container.innerHTML = `<div style="font-size:12px;color:var(--ink-soft);text-align:center;width:100%">No Adsgram tasks configured.</div>`;
    return;
  }

  container.innerHTML = `
    <adsgram-task 
      data-block-id="${blockId}" 
      data-debug="true" 
      data-debug-console="false" 
      class="task">
    </adsgram-task>
  `;

  setTimeout(() => {
    const taskEl = container.querySelector('adsgram-task');
    if (taskEl) {
      taskEl.addEventListener('reward', async (event) => {
        console.log('[Adsgram Task] Completed! Detail:', event.detail);
        haptic('success');
        toast('Task completed!', 'Reward will be credited shortly.');
      });
    }
  }, 100);
}

/* ========================================================================
   MAIN SETUP
   ======================================================================== */

/**
 * Set up all Earn screen event listeners and initial renders.
 */
export function setupEarn() {
  renderTasks();
  renderOffers();
  renderFeaturedOffers();
  renderPartners();
  renderAdsgramTasks();
  renderStreak();
  setupOfferFilters();
  startLiveFeed();
  setupFaucet();
  setupReferral();
}
