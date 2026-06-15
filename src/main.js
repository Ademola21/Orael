import { initTelegram, isTelegramEnv } from './telegram.js';
import { api } from './api.js';
import { updateState, setLocal, loadCachedState } from './state.js';
import { $, render, setupNavigation, setupSegmentedTabs, setupTierModal, setupModal } from './ui.js';
import { setupMining } from './mining.js';
import { buildWheel, setupPlay, renderLeaderboard } from './play.js';
import { setupEarn, renderTasks, renderStreak } from './earn.js';
import { setupWallet } from './wallet.js';

import './styles/index.css';

async function boot() {
  // 1. Initialize Telegram SDK
  const { tg, user, startParam } = initTelegram();

  // 2. Verify Telegram environment
  if (!isTelegramEnv()) {
    const gate = document.getElementById('tg-gate');
    const appEl = document.querySelector('.app');
    if (gate) gate.style.display = 'flex';
    if (appEl) appEl.style.display = 'none';
    return;
  }

  // Load cached user state if available to prevent flash of 0/lag
  if (user && user.id) {
    loadCachedState(user.id);
  }

  // Initial render (shows cached state or loading placeholders instantly)
  render();

  // Set user initials in UI
  if (user) {
    const initial = (user.first_name || 'A')[0].toUpperCase();
    const userAv = $('userAv');
    const lbAv = $('lbAv');
    if (userAv) userAv.textContent = initial;
    if (lbAv) lbAv.textContent = initial;
  }

  // 3. Fetch initial state from server
  try {
    let url = '/api/user';
    if (startParam) {
      url += `?start_param=${encodeURIComponent(startParam)}`;
    }
    const serverState = await api(url);
    updateState(serverState);
  } catch (error) {
    console.error('Failed to fetch user state on boot:', error);
  }

  // Mark state as loaded to render balance/energy
  setLocal('_loaded', true);

  // Fetch and render leaderboard helper
  async function fetchAndRenderLeaderboard() {
    try {
      const lbData = await api('/api/leaderboard');
      updateState({
        leaderboard: lbData.leaderboard,
        _userRank: lbData.userRank
      });
      renderLeaderboard(lbData.leaderboard);
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    }
  }

  // Fetch initial leaderboard
  await fetchAndRenderLeaderboard();

  // 4. Initialize UI and wire listeners
  buildWheel();
  setupNavigation();
  setupSegmentedTabs();
  setupTierModal();
  setupModal();
  setupMining();
  setupPlay();
  setupEarn();
  setupWallet();

  // 5. Initial render
  render();



  // 7. Start interval loops
  // Client-side local mining estimation and gauge update (every second)
  setInterval(() => {
    render();
  }, 1000);

  // Authoritative server state sync (every 30 seconds)
  setInterval(async () => {
    try {
      const serverState = await api('/api/user');
      updateState(serverState);
      render();
      renderTasks();
      renderStreak();
      await fetchAndRenderLeaderboard();
    } catch (e) {
      console.error('Background state sync failed:', e);
    }
  }, 30000);
}

// Start boot sequence when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
