/* ========================================================================
   ORAEL — Telegram Mini App logic
   Live mining simulation with localStorage persistence + simulated
   Adsgram rewarded-ad flow. Swap the `playAd()` stub for the real
   Adsgram SDK call in production (see README).
   ======================================================================== */

const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); } catch (e) {}

/* ---- Economy constants (from the business model) ---- */
const RATE_BASE = 2.5;            // ORL per hour
const SESSION_MS = 3 * 60 * 60 * 1000;  // 3 hours of fuel
const ORL_TO_NGN = 0.15;          // 1 ORL ≈ ₦0.15
const ARC_LEN = 395.8;            // 270° arc length for r=84
const AD_RING = 276.46;           // 2πr for r=44

/* ---- State ---- */
const now = () => Date.now();
const DEFAULT = {
  balance: 12480.5,
  miningStart: now(),            // when current fuel tank started
  boostUntil: 0,                 // boost active until ts
  streakDay: 3,                  // 1-indexed day claimed
  lastClaim: 0,
  tasks: { t1: false, t2: false, t3: false, t4: false },
  history: [
    { t: "Mining payout", a: "+1,250 ORL", k: "pos", d: "Today" },
    { t: "Referral bonus · @kemi", a: "+820 ORL", k: "pos", d: "Yesterday" },
    { t: "Withdrawal · Bank", a: "-50,000 ORL", k: "neg", d: "Jun 9" },
  ],
};

let S = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem("orael_v1"));
    return raw ? { ...DEFAULT, ...raw } : { ...DEFAULT };
  } catch (e) { return { ...DEFAULT }; }
}
function save() { localStorage.setItem("orael_v1", JSON.stringify(S)); }

/* ---- Derived mining math ---- */
function fuelMsLeft() { return Math.max(0, SESSION_MS - (now() - S.miningStart)); }
function energyPct() { return (fuelMsLeft() / SESSION_MS) * 100; }
function isBoosted() { return now() < S.boostUntil; }
function multiplier() { return isBoosted() ? 2 : 1; }
function ratePerHr() { return RATE_BASE * multiplier(); }
function isMining() { return fuelMsLeft() > 0; }

// ORL accrued in the *current* tank that hasn't been banked yet
let bankedStart = S.miningStart;
function accrueToBalance() {
  const elapsedMs = Math.min(now(), S.miningStart + SESSION_MS) - bankedStart;
  if (elapsedMs <= 0) return;
  const hrs = elapsedMs / 3600000;
  S.balance += hrs * ratePerHr();
  bankedStart = Math.min(now(), S.miningStart + SESSION_MS);
}

/* ---- Formatting ---- */
const fmt = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n) => Math.floor(n).toLocaleString("en-US");
const naira = (orl) => "₦" + fmt(orl * ORL_TO_NGN, 2);
function hms(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ---- DOM refs ---- */
const $ = (id) => document.getElementById(id);
const els = {
  balance: $("balance"), balanceFiat: $("balanceFiat"),
  ratePill: $("ratePill"), rateText: $("rateText"),
  sessionEarned: $("sessionEarned"),
  gaugeArc: $("gaugeArc"), energyNum: $("energyNum"),
  engineStatus: $("engineStatus"),
  timeLeft: $("timeLeft"), hashrate: $("hashrate"), boostState: $("boostState"),
  refuelBtn: $("refuelBtn"), boostBtn: $("boostBtn"),
  wBalance: $("wBalance"), wFiat: $("wFiat"), wProgress: $("wProgress"),
  wProgLabel: $("wProgLabel"), withdrawBtn: $("withdrawBtn"),
  historyList: $("historyList"), taskList: $("taskList"), streakStrip: $("streakStrip"),
};

let selectedMin = 50000;

/* ====================== RENDER ====================== */
function render() {
  accrueToBalance();
  const e = energyPct();
  const mining = isMining();

  // balance
  els.balance.textContent = fmt(S.balance);
  els.balanceFiat.textContent = naira(S.balance);

  // gauge
  els.gaugeArc.style.strokeDashoffset = (ARC_LEN * (1 - e / 100)).toFixed(1);
  els.energyNum.textContent = Math.round(e);

  // rate pill + engine status
  els.rateText.textContent = `+${fmt(ratePerHr(), 1)} / hr`;
  if (mining) {
    els.ratePill.classList.remove("idle");
    els.engineStatus.textContent = isBoosted() ? "Boosted · 2× speed" : "Mining active";
    els.engineStatus.classList.remove("empty");
  } else {
    els.ratePill.classList.add("idle");
    els.engineStatus.textContent = "Out of fuel";
    els.engineStatus.classList.add("empty");
  }

  // stats
  els.timeLeft.textContent = hms(fuelMsLeft());
  els.hashrate.textContent = fmt(ratePerHr(), 1);
  els.boostState.textContent = multiplier().toFixed(1) + "×";

  // session earned (this tank)
  const tankElapsed = Math.min(now(), S.miningStart + SESSION_MS) - S.miningStart;
  els.sessionEarned.textContent = fmt((tankElapsed / 3600000) * ratePerHr(), 4) + " ORL mined";

  // refuel button enabled only when low/empty
  els.refuelBtn.disabled = e > 95;
  els.boostBtn.disabled = isBoosted() || !mining;
  els.boostBtn.querySelector(".btn-stack").firstChild.textContent =
    isBoosted() ? "2× Boost active" : "Activate 2× Boost";

  // wallet
  els.wBalance.textContent = fmt(S.balance);
  els.wFiat.textContent = naira(S.balance).slice(1);
  const pct = Math.min(100, (S.balance / selectedMin) * 100);
  els.wProgress.style.width = pct + "%";
  els.wProgLabel.textContent = `${fmtInt(S.balance)} / ${fmtInt(selectedMin)} ORL`;
  els.withdrawBtn.disabled = S.balance < selectedMin;
  els.withdrawBtn.textContent = S.balance < selectedMin
    ? `Need ${fmtInt(selectedMin - S.balance)} more ORL` : "Withdraw now";
}

/* ====================== HISTORY / TASKS / STREAK ====================== */
function renderHistory() {
  els.historyList.innerHTML = S.history.map(h => `
    <div class="item">
      <div class="item-ic">${h.k === "neg" ? icoOut : icoIn}</div>
      <div class="item-body"><div class="item-title">${h.t}</div><div class="item-sub">${h.d}</div></div>
      <div class="item-reward ${h.k}">${h.a}</div>
    </div>`).join("");
}
const icoIn = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0 5-5m-5 5-5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const icoOut = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0 5 5m-5-5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const TASKS = [
  { id: "t1", title: "Watch a sponsored video", sub: "15s · rewarded ad", reward: "+50 ORL" },
  { id: "t2", title: "Visit partner offer", sub: "Open link · 10s", reward: "+35 ORL" },
  { id: "t3", title: "Join Orael channel", sub: "Telegram", reward: "+120 ORL" },
  { id: "t4", title: "Daily quiz", sub: "Answer 1 question", reward: "+40 ORL" },
];
function renderTasks() {
  els.taskList.innerHTML = TASKS.map(t => {
    const done = S.tasks[t.id];
    return `<div class="item ${done ? "done" : ""}" data-task="${t.id}" data-reward="${t.reward}">
      <div class="item-ic">${icoPlay}</div>
      <div class="item-body"><div class="item-title">${t.title}</div><div class="item-sub">${t.sub}</div></div>
      <div class="chip-go">${done ? "Done" : t.reward}</div>
    </div>`;
  }).join("");
  els.taskList.querySelectorAll("[data-task]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.task;
      if (S.tasks[id]) return;
      playAd("Loading offer…", "Reward unlocks when it finishes.", 8, () => {
        S.tasks[id] = true;
        const amt = parseInt(el.dataset.reward.replace(/\D/g, ""));
        S.balance += amt; save(); renderTasks(); render();
        toast(`Task complete`, `+${amt} ORL`);
      });
    });
  });
}
const icoPlay = `<svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="#e0a25b"/></svg>`;

function renderStreak() {
  const amts = [50, 80, 120, 180, 260, 360, 600];
  els.streakStrip.innerHTML = amts.map((a, i) => {
    const day = i + 1;
    const cls = day < S.streakDay ? "claimed" : day === S.streakDay ? "today" : "";
    return `<div class="day ${cls}"><div>D${day}</div><div class="d-amt">${a}</div></div>`;
  }).join("");
}

/* ====================== AD FLOW (simulated Adsgram) ====================== */
let adTimer = null;
function playAd(title, body, seconds, onReward) {
  haptic("light");
  const veil = $("adVeil"), ring = $("adRing"), num = $("adNum");
  $("adTitle").textContent = title;
  $("adBody").textContent = body;
  veil.classList.add("show");
  let left = seconds;
  num.textContent = left;
  ring.style.strokeDashoffset = AD_RING;
  ring.style.transition = "none";
  // kick transition
  requestAnimationFrame(() => {
    ring.style.transition = `stroke-dashoffset ${seconds}s linear`;
    ring.style.strokeDashoffset = "0";
  });
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    left--;
    num.textContent = Math.max(0, left);
    if (left <= 0) {
      clearInterval(adTimer);
      veil.classList.remove("show");
      haptic("success");
      onReward && onReward();
    }
  }, 1000);
}

/* In production, replace the body of playAd's reward path with Adsgram:
   const AdController = window.Adsgram.init({ blockId: "YOUR_BLOCK_ID" });
   AdController.show().then(() => { onReward(); }).catch(() => { ... });
*/

/* ====================== ACTIONS ====================== */
els.refuelBtn.addEventListener("click", () => {
  playAd("Refueling engine…", "Your reward unlocks when the ad finishes.", 15, () => {
    accrueToBalance();
    S.miningStart = now();
    bankedStart = now();
    save(); render();
    toast("Engine refueled", "Fuel restored to 100%");
  });
});

els.boostBtn.addEventListener("click", () => {
  if (isBoosted() || !isMining()) return;
  playAd("Loading boost…", "Double your mining speed for 3 hours.", 15, () => {
    accrueToBalance();
    S.boostUntil = now() + SESSION_MS;
    save(); render();
    toast("2× Boost active", "Speed doubled for 3 hours");
  });
});

els.withdrawBtn.addEventListener("click", () => {
  if (S.balance < selectedMin) return;
  const amt = Math.floor(S.balance);
  S.balance -= amt;
  S.history.unshift({ t: "Withdrawal requested", a: `-${fmtInt(amt)} ORL`, k: "neg", d: "Just now" });
  save(); render(); renderHistory();
  toast("Withdrawal requested", naira(amt) + " on its way");
  haptic("success");
});

document.querySelectorAll(".method").forEach(m => {
  m.addEventListener("click", () => {
    document.querySelectorAll(".method").forEach(x => x.classList.remove("sel"));
    m.classList.add("sel");
    selectedMin = parseInt(m.dataset.min);
    render();
  });
});

$("copyRef").addEventListener("click", () => {
  const code = $("refCode").textContent;
  navigator.clipboard?.writeText(code);
  toast("Invite link copied", "Share it anywhere");
});

/* ====================== NAV ====================== */
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    haptic("light");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    btn.classList.add("active");
    $("screen-" + btn.dataset.screen).classList.add("active");
    document.querySelector(".scroll").scrollTo({ top: 0, behavior: "smooth" });
  });
});

/* ====================== TOAST ====================== */
function toast(title, coin) {
  const wrap = $("toastWrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>${title}</span>${coin ? `<span class="tcoin">${coin}</span>` : ""}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; }, 2300);
  setTimeout(() => el.remove(), 2700);
}

/* ====================== HAPTICS ====================== */
function haptic(type) {
  try {
    const h = tg?.HapticFeedback;
    if (!h) return;
    if (type === "success") h.notificationOccurred("success");
    else h.impactOccurred(type === "light" ? "light" : "medium");
  } catch (e) {}
}

/* ====================== INIT ====================== */
(function init() {
  const u = tg?.initDataUnsafe?.user;
  if (u) {
    $("userAv").textContent = (u.first_name || "A")[0].toUpperCase();
  }
  if (tg) {
    document.documentElement.style.setProperty("--safe-top", (tg.safeAreaInset?.top || 0) + "px");
    document.documentElement.style.setProperty("--safe-bot", (tg.safeAreaInset?.bottom || 0) + "px");
  }
  renderHistory(); renderTasks(); renderStreak(); render();
  setInterval(() => { save(); render(); }, 1000);
})();
