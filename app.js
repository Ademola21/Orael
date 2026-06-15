/* ========================================================================
   ORAEL — Telegram Mini App logic (full feature set)
   Live simulation + localStorage. Swap playAd() / ad + Stars stubs for the
   real Adsgram SDK and Telegram Stars invoices in production (see README).
   ======================================================================== */

const tg = window.Telegram?.WebApp;
try { tg?.ready(); tg?.expand(); } catch (e) {}

/* ---- Economy constants ---- */
const SESSION_MS = 3 * 60 * 60 * 1000;   // boost duration
const ORL_TO_NGN = 0.03;                 // 1 ORL = ₦0.03  ($1 = 50,000 ORL)
const TANK_ORL = 30;                     // fixed ORL per refuel tank (fixed-tank model)
const ARC_LEN = 395.8, AD_RING = 276.46;
const RIGS = [
  { name: "Rig I",   sessionMin: 180, cost: 0 },
  { name: "Rig II",  sessionMin: 150, cost: 5000 },
  { name: "Rig III", sessionMin: 120, cost: 20000 },
  { name: "Rig IV",  sessionMin: 90,  cost: 60000 },
  { name: "Rig V",   sessionMin: 60,  cost: 150000 },
];
const FAUCET_COOLDOWN = 60 * 60 * 1000;
const FAUCET_REWARD = 20;
const LOTTO_TICKET_ORL = 500;
const CHEST_GOAL = 5;
const WHEEL_PRIZES = [100, 50, 250, 0, 30, 15, 500, 5];
const WHEEL_WEIGHTS = [8, 14, 1.5, 22, 12, 18, 0.5, 24];

/* ---- State ---- */
const now = () => Date.now();
const todayKey = () => new Date().toISOString().slice(0, 10);
const DEFAULT = {
  balance: 12480.5,
  tankMined: 0,
  lastAccrue: now(),
  boostUntil: 0,
  rigLevel: 1,
  pro: 0,
  streakDay: 3,
  faucetLast: 0,
  spinDay: "", spinFreeUsed: false,
  scratchDay: "", scratchLeft: 3,
  chest: 0,
  lottoDay: "", lottoMine: 0,
  stake: null,
  tasks: {}, offers: {}, surveys: {}, featured: {},
  ref: { count: 14, earned: 8420, active: 9 },
  history: [
    { t: "Mining payout", a: "+1,250 ORL", k: "pos", d: "Today" },
    { t: "Referral bonus · @kemi", a: "+820 ORL", k: "pos", d: "Yesterday" },
    { t: "Withdrawal · Bank", a: "-50,000 ORL", k: "neg", d: "Jun 9" },
  ],
};
let S = load();
function load() {
  try { const r = JSON.parse(localStorage.getItem("orael_v3")); return r ? { ...DEFAULT, ...r } : { ...DEFAULT }; }
  catch (e) { return { ...DEFAULT }; }
}
function save() { localStorage.setItem("orael_v3", JSON.stringify(S)); }

/* daily resets */
function rollDay() {
  const t = todayKey();
  if (S.spinDay !== t) { S.spinDay = t; S.spinFreeUsed = false; }
  if (S.scratchDay !== t) { S.scratchDay = t; S.scratchLeft = isPro() ? 6 : 3; }
  if (S.lottoDay !== t) { S.lottoDay = t; S.lottoMine = 0; }
}

/* ---- Derived (fixed-tank economy) ---- */
const isPro = () => now() < S.pro;
const isBoosted = () => now() < S.boostUntil;
const mult = () => (isPro() ? 2 : 1) * (isBoosted() ? 2 : 1);
const sessionHrs = () => RIGS[S.rigLevel].sessionMin / 60;
const ratePerHr = () => (TANK_ORL / sessionHrs()) * mult();
const energyPct = () => Math.max(0, (TANK_ORL - S.tankMined) / TANK_ORL * 100);
const isMining = () => S.tankMined < TANK_ORL - 1e-9;
const fuelMsLeft = () => isMining() ? ((TANK_ORL - S.tankMined) / ratePerHr()) * 3600000 : 0;
const totalMult = () => mult();

function accrue() {
  const t = now(); const dt = t - S.lastAccrue; S.lastAccrue = t;
  if (dt <= 0 || S.tankMined >= TANK_ORL) return;
  let orl = (dt / 3600000) * ratePerHr();
  orl = Math.min(orl, TANK_ORL - S.tankMined);
  S.balance += orl; S.tankMined += orl;
}

/* ---- Format ---- */
const fmt = (n, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n) => Math.floor(n).toLocaleString("en-US");
const naira = (orl) => "₦" + fmt(orl * ORL_TO_NGN, 2);
function hms(ms) { const s = Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), x=s%60; return `${h}:${String(m).padStart(2,"0")}:${String(x).padStart(2,"0")}`; }
const $ = (id) => document.getElementById(id);

/* ========================================================================
   RENDER (core)
   ======================================================================== */
let selectedMin = 50000, selectedName = "Bank (NGN)";
function render() {
  rollDay(); accrue();
  const e = energyPct(), mining = isMining();
  document.body.classList.toggle("is-pro", isPro());

  $("balance").textContent = fmt(S.balance);
  $("balanceFiat").textContent = naira(S.balance);
  $("gaugeArc").style.strokeDashoffset = (ARC_LEN * (1 - e/100)).toFixed(1);
  $("energyNum").textContent = Math.round(e);
  const st = $("engineStatus");
  if (mining) { st.classList.remove("empty");
    st.textContent = isBoosted() ? "Boosted · 2× speed" : (isPro() ? "Pro mining" : "Mining active"); }
  else { st.classList.add("empty"); st.textContent = "Out of fuel"; }

  $("timeLeft").textContent = hms(fuelMsLeft());
  $("hashrate").textContent = fmt(ratePerHr(),1);
  $("boostState").textContent = totalMult().toFixed(1) + "×";
  $("sessionEarned").textContent = fmt(S.tankMined,4) + " ORL mined";

  $("refuelBtn").disabled = e > 95;
  $("boostBtn").disabled = isBoosted() || !mining;
  $("boostBtn").querySelector(".btn-stack").firstChild.textContent = isBoosted() ? "2× Boost active" : "Activate 2× Boost";

  // faucet
  const fr = now() - S.faucetLast;
  if (fr >= FAUCET_COOLDOWN) { $("faucetStatus").textContent = "Ready to claim"; $("faucetBtn").disabled = false; $("faucetBtn").textContent = "Claim"; }
  else { $("faucetStatus").textContent = "Next in " + hms(FAUCET_COOLDOWN - fr); $("faucetBtn").disabled = true; $("faucetBtn").textContent = "Wait"; }

  // rig
  renderRig();

  // wallet
  $("wBalance").textContent = fmt(S.balance);
  $("wFiat").textContent = naira(S.balance).slice(1);
  $("wProgress").style.width = Math.min(100, (S.balance/selectedMin)*100) + "%";
  $("wProgLabel").textContent = `${fmtInt(S.balance)} / ${fmtInt(selectedMin)} ORL`;
  const can = S.balance >= selectedMin;
  $("withdrawBtn").disabled = !can;
  $("withdrawBtn").textContent = can ? `Withdraw to ${selectedName}` : `Need ${fmtInt(selectedMin - S.balance)} more ORL`;
  const feePct = isPro() ? 5 : 10;
  const amt = can ? Math.floor(S.balance) : 0;
  const fee = Math.floor(amt * feePct/100);
  $("feePct").textContent = feePct;
  $("feeAmt").textContent = fmtInt(amt) + " ORL";
  $("feeVal").textContent = fmtInt(fee) + " ORL";
  $("feeNet").textContent = naira(amt - fee);

  // spin / scratch / chest / lotto
  $("spinTag").textContent = S.spinFreeUsed ? "ad to spin" : "1 free today";
  $("spinBtn").textContent = S.spinFreeUsed ? "Spin again (watch ad)" : "Spin the wheel";
  $("scratchTag").textContent = `${S.scratchLeft} left today`;
  $("chestBar").style.width = (S.chest/CHEST_GOAL*100) + "%";
  $("chestCap").textContent = `${S.chest} / ${CHEST_GOAL} ads watched`;
  $("lottoMine").textContent = S.lottoMine;

  // referrals
  $("refCount").textContent = S.ref.count;
  $("refEarned").textContent = fmtInt(S.ref.earned);
  $("refActive").textContent = S.ref.active;

  // staking
  renderStake();
}

function renderRig() {
  const r = RIGS[S.rigLevel], next = RIGS[S.rigLevel+1];
  $("rigName").textContent = r.name;
  $("rigRate").textContent = fmt(TANK_ORL / (r.sessionMin/60), 1);
  const meter = $("rigMeter");
  meter.innerHTML = RIGS.map((_, i) => `<div class="rig-seg ${i <= S.rigLevel ? "on":""}"></div>`).join("");
  if (next) {
    $("rigNext").textContent = fmt(TANK_ORL / (next.sessionMin/60), 1);
    $("rigBtn").textContent = `Upgrade · ${fmtInt(next.cost)} ORL`;
    $("rigBtn").disabled = S.balance < next.cost;
  } else {
    $("rigNext").textContent = "MAX";
    $("rigBtn").textContent = "Max rig";
    $("rigBtn").disabled = true;
  }
}

function renderStake() {
  const box = $("stakeActive");
  if (S.stake && now() < S.stake.until) {
    box.hidden = false;
    box.innerHTML = `Staking <b>${fmtInt(S.stake.amount)} ORL</b> at <b>${S.stake.apy}% APY</b> · unlocks in ${hms(S.stake.until-now())}`;
    $("stakeBtn").textContent = "Staked";
    $("stakeBtn").disabled = true;
  } else {
    if (S.stake && now() >= S.stake.until) { // mature -> pay yield
      const yield_ = Math.floor(S.stake.amount * S.stake.apy/100);
      S.balance += S.stake.amount + yield_;
      addHistory("Staking matured", `+${fmtInt(S.stake.amount+yield_)} ORL`, "pos", "Just now");
      S.stake = null; save();
      reward(yield_, "Stake matured", "Your ORL plus yield is back in your balance.");
    }
    box.hidden = true;
    $("stakeBtn").textContent = "Stake 10,000 ORL";
    $("stakeBtn").disabled = S.balance < 10000;
  }
}

/* ========================================================================
   LISTS: tasks, featured, offers, surveys, history, streak, leaderboard
   ======================================================================== */
const icoIn = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14m0 0 5-5m-5 5-5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const icoOut = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0 5 5m-5-5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const icoPlay = `<svg viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="#e0a25b"/></svg>`;
const icoStar = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.5 6 .5-4.5 4 1.4 5.9L12 16.8 6.6 18.9 8 13 3.5 9l6-.5L12 3z" fill="#e0a25b"/></svg>`;
const icoApp = `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/></svg>`;
const icoSurvey = `<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

function addHistory(t, a, k, d) { S.history.unshift({ t, a, k, d }); S.history = S.history.slice(0, 12); }
function renderHistory() {
  $("historyList").innerHTML = S.history.map(h => `
    <div class="item"><div class="item-ic">${h.k==="neg"?icoOut:icoIn}</div>
    <div class="item-body"><div class="item-title">${h.t}</div><div class="item-sub">${h.d}</div></div>
    <div class="item-reward ${h.k}">${h.a}</div></div>`).join("");
}

const TASKS = [
  { id:"t1", title:"Watch a sponsored video", sub:"15s · rewarded ad", r:25 },
  { id:"t2", title:"Visit partner offer", sub:"Open link · 10s", r:20 },
  { id:"t3", title:"Daily quiz", sub:"Answer 1 question", r:20 },
];
const FEATURED = [
  { id:"f1", title:"Join TonStation", sub:"Open & start the bot", r:30 },
  { id:"f2", title:"Follow Orael on X", sub:"Tap follow", r:25 },
  { id:"f3", title:"Subscribe Orael channel", sub:"Telegram", r:25 },
];
const OFFERS = [
  { id:"o1", title:"Install Monopoly GO", sub:"Reach level 5", r:25000, usd:"$0.50", b:"g", cat:"game" },
  { id:"o2", title:"Sign up Bybit + KYC", sub:"Verify identity", r:137500, usd:"$2.75", b:"b", cat:"finance" },
  { id:"o3", title:"Try Temu, place order", sub:"First purchase", r:50000, usd:"$1.00", b:"g", cat:"shop" },
  { id:"o4", title:"Install & open TikTok Lite", sub:"Keep 3 days", r:20000, usd:"$0.40", b:"b", cat:"game" },
  { id:"o5", title:"Open a Bitget account", sub:"Deposit + first trade", r:115000, usd:"$2.30", b:"b", cat:"finance" },
  { id:"o6", title:"Shop on AliExpress", sub:"First order $5+", r:40000, usd:"$0.80", b:"g", cat:"shop" },
];
const FEATURED_OFFERS = [
  { title:"Cooking Blast", pay:"+34,300", emoji:"🍳", g:"linear-gradient(135deg,#8e6cc4,#4a3270)", plat:"a" },
  { title:"Rock N Cash Casino", pay:"+841,000", emoji:"🎰", g:"linear-gradient(135deg,#c0392b,#6e1d14)", plat:"a" },
  { title:"Ball Sort Master", pay:"+5,400", emoji:"🧪", g:"linear-gradient(135deg,#2e7bd6,#173f70)", plat:"a" },
  { title:"Bingo Frenzy", pay:"+62,000", emoji:"🎯", g:"linear-gradient(135deg,#d98a2b,#854f12)", plat:"a" },
  { title:"Solitaire Cash", pay:"+128,000", emoji:"🃏", g:"linear-gradient(135deg,#2f9e6e,#185138)", plat:"a" },
];
const OFFER_PARTNERS = [
  { name:"Tyr Treasures", bonus:"+50%", emoji:"💰" },
  { name:"Prime Earn", bonus:"+55%", emoji:"💎" },
  { name:"Timewall", bonus:"+40%", emoji:"⏳" },
  { name:"AdGem", bonus:"+35%", emoji:"🎮" },
  { name:"BitLabs", bonus:"+45%", emoji:"📊" },
];
const LIVE_GAMES = [
  ["Train Miner: Idle Railway","🚂"],["Block Jam","🧱"],["Bingo Frenzy","🎯"],["Royal Match","👑"],
  ["Coin Master","🪙"],["Monopoly GO","🎲"],["Solitaire Cash","🃏"],["Travel Town","🏝️"],["Rock N Cash","🎰"],
];
const LIVE_USERS = ["@chidi","@zainab","MinerKing","@tunde","Blessing","@ifeoma","RigBoss","@amaka","Daniel","@yusuf"];
const SURVEYS = [
  { id:"s1", title:"Consumer habits survey", sub:"~4 min · BitLabs", r:15000, usd:"$0.30" },
  { id:"s2", title:"Mobile gaming poll", sub:"~2 min · CPX", r:8000, usd:"$0.16" },
  { id:"s3", title:"Shopping preferences", sub:"~6 min · CPX", r:21000, usd:"$0.42" },
];

function chipFor(done, label) { return `<div class="chip-go">${done ? "Done" : label}</div>`; }

function renderTasks() {
  $("taskList").innerHTML = TASKS.map(t => `
    <div class="item ${S.tasks[t.id]?"done":""}" data-kind="tasks" data-id="${t.id}" data-r="${t.r}">
      <div class="item-ic">${icoPlay}</div>
      <div class="item-body"><div class="item-title">${t.title}</div><div class="item-sub">${t.sub}</div></div>
      ${chipFor(S.tasks[t.id], "+"+t.r+" ORL")}</div>`).join("");
  $("featuredList").innerHTML = FEATURED.map(t => `
    <div class="item featured ${S.featured[t.id]?"done":""}" data-kind="featured" data-id="${t.id}" data-r="${t.r}">
      <div class="item-ic">${icoStar}</div>
      <div class="item-body"><div class="item-title">${t.title}</div><div class="item-sub">${t.sub}</div></div>
      ${chipFor(S.featured[t.id], "+"+t.r+" ORL")}</div>`).join("");
  const ofs = offerFilter==="all" ? OFFERS : OFFERS.filter(o=>o.cat===offerFilter);
  $("offerList").innerHTML = ofs.map(o => `
    <div class="item ${S.offers[o.id]?"done":""}" data-kind="offers" data-id="${o.id}" data-r="${o.r}">
      <div class="item-ic brand-${o.b}">${icoApp}</div>
      <div class="item-body"><div class="item-title">${o.title}</div><div class="item-sub">${o.sub}</div></div>
      <div class="offer-reward"><div class="or-orl">+${fmtInt(o.r)}</div><div class="or-usd">${o.usd} payout</div></div></div>`).join("");
  $("surveyList").innerHTML = SURVEYS.map(o => `
    <div class="item ${S.surveys[o.id]?"done":""}" data-kind="surveys" data-id="${o.id}" data-r="${o.r}">
      <div class="item-ic">${icoSurvey}</div>
      <div class="item-body"><div class="item-title">${o.title}</div><div class="item-sub">${o.sub}</div></div>
      <div class="offer-reward"><div class="or-orl">+${fmtInt(o.r)}</div><div class="or-usd">${o.usd} payout</div></div></div>`).join("");

  document.querySelectorAll("[data-kind]").forEach(el => {
    el.addEventListener("click", () => {
      const { kind, id } = el.dataset; const r = parseInt(el.dataset.r);
      if (S[kind][id]) return;
      const label = kind === "surveys" ? "Loading survey…" : kind === "offers" ? "Opening offer…" : "Loading…";
      playAd(label, "Reward credits when you complete it.", kind === "tasks" ? 10 : 6, () => {
        S[kind][id] = true; S.balance += r; save(); renderTasks(); render();
        addHistory(el.querySelector(".item-title").textContent, `+${fmtInt(r)} ORL`, "pos", "Just now");
        renderHistory();
        reward(r, "Reward earned", "Nice. Keep stacking ORL.");
      });
    });
  });
}

const icoDroid = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 9h10v7a1 1 0 0 1-1 1h-1v3h-2v-3h-2v3H9v-3H8a1 1 0 0 1-1-1V9zm-2 .5a1 1 0 0 1 2 0v5a1 1 0 0 1-2 0v-5zm12 0a1 1 0 0 1 2 0v5a1 1 0 0 1-2 0v-5zM8 8a4 4 0 0 1 8 0H8z"/></svg>`;
let offerFilter = "all";
function renderFeatured() {
  $("featuredOffers").innerHTML = FEATURED_OFFERS.map(f => `
    <div class="foffer">
      <div class="cover" style="background:${f.g}">${f.emoji}${f.plat==="a"?`<span class="plat">${icoDroid}</span>`:""}</div>
      <div class="meta"><div class="ft">${f.title}</div><div class="fp">${f.pay}</div></div>
    </div>`).join("");
}
function renderPartners() {
  $("offerPartners").innerHTML = OFFER_PARTNERS.map(p => `
    <div class="partner"><span class="bonus">${p.bonus}</span>
      <div class="plogo">${p.emoji}</div><div class="pname">${p.name}</div><div class="pgo">Tap to open</div></div>`).join("");
}
function setupOfferFilters() {
  document.querySelectorAll("#offerFilters .fpill").forEach(p => p.addEventListener("click", () => {
    document.querySelectorAll("#offerFilters .fpill").forEach(x=>x.classList.remove("on"));
    p.classList.add("on"); offerFilter = p.dataset.f; renderTasks(); render();
  }));
}
let liveTimer = null;
function liveRow() {
  const g = LIVE_GAMES[Math.floor(Math.random()*LIVE_GAMES.length)];
  const u = LIVE_USERS[Math.floor(Math.random()*LIVE_USERS.length)];
  const pay = (Math.random()*4+0.05).toFixed(3);
  const ago = Math.floor(Math.random()*5);
  return `<div class="live-row"><div class="live-thumb">${g[1]}</div>
    <div class="live-body"><div class="live-name">${g[0]}</div><div class="live-user">${u}</div></div>
    <div><div class="live-pay">+$${pay}</div><div class="live-ago">${ago===0?"just now":ago+"m ago"}</div></div></div>`;
}
function startLiveFeed() {
  const feed = $("liveFeed"); if (!feed) return;
  feed.innerHTML = Array.from({length:5}, liveRow).join("");
  clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    feed.insertAdjacentHTML("afterbegin", liveRow());
    while (feed.children.length > 6) feed.removeChild(feed.lastChild);
  }, 3500);
}

function renderStreak() {
  const amts = [50,80,120,180,260,360,600];
  $("streakStrip").innerHTML = amts.map((a,i) => {
    const day=i+1, cls = day<S.streakDay?"claimed":day===S.streakDay?"today":"";
    return `<div class="day ${cls}"><div>D${day}</div><div class="d-amt">${a}</div></div>`;
  }).join("");
}

function renderLeaderboard() {
  const names = [["Chidi","2.41M"],["@zainab","2.08M"],["MinerKing","1.77M"],["@tunde","1.42M"],["Blessing","1.20M"],["@ifeoma","980K"],["RigBoss","860K"]];
  let rows = names.map((n,i)=>`<div class="lb-row"><div class="lb-rank ${i<3?"top":""}">${i+1}</div>
    <div class="lb-av">${n[0].replace("@","")[0].toUpperCase()}</div>
    <div class="lb-name">${n[0]}</div><div class="lb-amt">${n[1]} ORL</div></div>`).join("");
  rows += `<div class="lb-row lb-me"><div class="lb-rank">128</div><div class="lb-av" id="lbAv">A</div>
    <div class="lb-name">You<small>climb to reach the prize pool</small></div><div class="lb-amt">${fmtInt(S.balance)} ORL</div></div>`;
  $("leaderboard").innerHTML = rows;
}

/* ========================================================================
   WHEEL
   ======================================================================== */
function buildWheel() {
  const svg = $("wheel"); const n = WHEEL_PRIZES.length; const cx=100, cy=100, r=100;
  let html = "";
  for (let i=0;i<n;i++) {
    const a0 = (i*360/n - 90) * Math.PI/180, a1 = ((i+1)*360/n - 90) * Math.PI/180;
    const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0), x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
    const fill = i%2===0 ? "#241f1b" : "#2f2722";
    html += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z" fill="${fill}" stroke="#3a312a" stroke-width="0.5"/>`;
    const am = (a0+a1)/2, tx=cx+r*0.66*Math.cos(am), ty=cy+r*0.66*Math.sin(am);
    const label = WHEEL_PRIZES[i]===0 ? "✕" : WHEEL_PRIZES[i];
    html += `<text x="${tx}" y="${ty}" fill="#e0a25b" font-size="13" font-family="Space Grotesk" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(${(i*360/n)+(360/n/2)} ${tx} ${ty})">${label}</text>`;
  }
  svg.innerHTML = html;
}
let wheelRot = 0, spinning = false;
function doSpin() {
  if (spinning) return;
  let idx = weightedPick(WHEEL_WEIGHTS);
  const n = WHEEL_PRIZES.length, seg = 360/n;
  const target = 360*5 + (360 - (idx*seg + seg/2));
  wheelRot += target;
  spinning = true;
  $("wheel").style.transform = `rotate(${wheelRot}deg)`;
  setTimeout(() => {
    spinning = false;
    const p = WHEEL_PRIZES[idx];
    if (p > 0) { S.balance += p; save(); addHistory("Lucky spin", `+${p} ORL`, "pos", "Just now"); renderHistory(); reward(p, "Lucky spin!", "Spin again tomorrow for free."); }
    else { toast("So close", "No win this time"); }
    render();
  }, 4700);
}
function weightedPick(w) { const tot=w.reduce((a,b)=>a+b,0); let x=Math.random()*tot; for(let i=0;i<w.length;i++){ if(x<w[i]) return i; x-=w[i]; } return 0; }

/* ========================================================================
   AD FLOW (simulated Adsgram)
   ======================================================================== */
let adTimer = null;
function playAd(title, body, seconds, onReward) {
  haptic("light");
  const veil=$("adVeil"), ring=$("adRing"), num=$("adNum");
  $("adTitle").textContent = title; $("adBody").textContent = body;
  veil.classList.add("show");
  let left = seconds; num.textContent = left;
  ring.style.transition = "none"; ring.style.strokeDashoffset = AD_RING;
  requestAnimationFrame(() => { ring.style.transition = `stroke-dashoffset ${seconds}s linear`; ring.style.strokeDashoffset = "0"; });
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    left--; num.textContent = Math.max(0,left);
    if (left<=0) { clearInterval(adTimer); veil.classList.remove("show"); haptic("success"); onReward && onReward(); }
  }, 1000);
}
/* PRODUCTION:
   const ad = window.Adsgram.init({ blockId: "BLOCK_ID" });
   ad.show().then(() => onReward()).catch(() => {});  */

/* ========================================================================
   REWARD MODAL + TOAST + HAPTIC
   ======================================================================== */
function reward(amount, title, body) {
  $("modalTitle").textContent = title;
  $("modalAmt").textContent = (amount>=0?"+":"") + fmtInt(amount) + " ORL";
  $("modalBody").textContent = body || "Added to your balance.";
  $("modalVeil").classList.add("show");
  haptic("success");
}
$("modalClose").addEventListener("click", () => $("modalVeil").classList.remove("show"));

function toast(title, coin) {
  const el = document.createElement("div"); el.className="toast";
  el.innerHTML = `<span>${title}</span>${coin?`<span class="tcoin">${coin}</span>`:""}`;
  $("toastWrap").appendChild(el);
  setTimeout(()=>{el.style.opacity="0";el.style.transform="translateY(8px)";},2300);
  setTimeout(()=>el.remove(),2700);
}
function haptic(type){ try{ const h=tg?.HapticFeedback; if(!h)return; if(type==="success")h.notificationOccurred("success"); else h.impactOccurred(type==="light"?"light":"medium"); }catch(e){} }

/* ========================================================================
   ACTIONS
   ======================================================================== */
$("refuelBtn").addEventListener("click", () => {
  const go = () => { accrue(); S.tankMined=0; S.lastAccrue=now(); save(); render(); toast("Engine refueled","Fuel at 100%"); };
  if (isPro()) { go(); return; }   // Pro refuels without ads
  playAd("Refueling engine…","Reward unlocks when the ad finishes.",15,go);
});
$("boostBtn").addEventListener("click", () => {
  if (isBoosted() || !isMining()) return;
  playAd("Loading boost…","Double mining speed for 3 hours.",15,()=>{ accrue(); S.boostUntil=now()+SESSION_MS; save(); render(); toast("2× Boost active","Speed doubled for 3h"); });
});
$("faucetBtn").addEventListener("click", () => {
  if (now()-S.faucetLast < FAUCET_COOLDOWN) return;
  playAd("Claiming bonus…","Your hourly drip is loading.",10,()=>{ S.faucetLast=now(); S.balance+=FAUCET_REWARD; save(); render(); addHistory("Hourly bonus",`+${FAUCET_REWARD} ORL`,"pos","Just now"); renderHistory(); toast("Hourly bonus",`+${FAUCET_REWARD} ORL`); });
});
$("rigBtn").addEventListener("click", () => {
  const next = RIGS[S.rigLevel+1]; if (!next || S.balance < next.cost) return;
  S.balance -= next.cost; S.rigLevel++; save(); render();
  addHistory(`Upgraded to ${RIGS[S.rigLevel].name}`, `-${fmtInt(next.cost)} ORL`, "neg", "Just now"); renderHistory();
  reward(0, `${RIGS[S.rigLevel].name} online`, `Now mining ${fmt(TANK_ORL/(RIGS[S.rigLevel].sessionMin/60),1)} ORL/hr — faster sessions.`);
});

$("spinBtn").addEventListener("click", () => {
  if (spinning) return;
  if (!S.spinFreeUsed) { S.spinFreeUsed=true; save(); doSpin(); render(); }
  else { playAd("Loading spin…","Watch to earn an extra spin.",10,()=>{ doSpin(); }); }
});

$("scratchBtn").addEventListener("click", () => {
  if (S.scratchLeft<=0) { toast("No cards left","Come back tomorrow"); return; }
  playAd("Loading card…","Scratch to reveal your prize.",8,()=>{
    S.scratchLeft--; const prizes=[5,15,30,60,150,0]; const w=[40,30,18,8,1,3];
    const p = prizes[weightedPick(w)];
    const card=$("scratch"); card.classList.remove("revealed");
    $("scratchPrize").textContent = p>0 ? "+"+p : "✕";
    card.onclick = () => {
      card.classList.add("revealed"); card.onclick=null;
      if (p>0){ S.balance+=p; addHistory("Scratch win",`+${p} ORL`,"pos","Just now"); renderHistory(); toast("Scratch win!",`+${p} ORL`);} else toast("No luck","Try the next one");
      save(); render();
    };
    save(); render();
  });
});

$("chestBtn").addEventListener("click", () => {
  playAd("Filling chest…","Each ad gets you closer to the loot.",10,()=>{
    S.chest++;
    if (S.chest>=CHEST_GOAL){ S.chest=0; const p=100+Math.floor(Math.random()*51); S.balance+=p; addHistory("Mystery chest",`+${p} ORL`,"pos","Just now"); renderHistory(); reward(p,"Chest unlocked!","Big haul. Fill another one?"); }
    else toast("Chest filling",`${S.chest}/${CHEST_GOAL}`);
    save(); render();
  });
});

$("lottoAdBtn").addEventListener("click", () => {
  playAd("Loading ticket…","Watch to grab a free entry.",10,()=>{ S.lottoMine++; save(); render(); toast("Ticket added","Good luck tonight"); });
});
$("lottoBuyBtn").addEventListener("click", () => {
  if (S.balance < LOTTO_TICKET_ORL) { toast("Not enough ORL", `Need ${LOTTO_TICKET_ORL}`); return; }
  S.balance -= LOTTO_TICKET_ORL; S.lottoMine++; save(); render(); toast("Ticket bought","Entry confirmed");
});

document.querySelectorAll(".method").forEach(m => m.addEventListener("click", () => {
  document.querySelectorAll(".method").forEach(x=>x.classList.remove("sel"));
  m.classList.add("sel"); selectedMin=parseInt(m.dataset.min); selectedName=m.dataset.name; render();
}));
$("withdrawBtn").addEventListener("click", () => {
  if (S.balance < selectedMin) return;
  const amt=Math.floor(S.balance), fee=Math.floor(amt*(isPro()?5:10)/100), net=amt-fee;
  S.balance-=amt; addHistory(`Withdrawal · ${selectedName}`, `-${fmtInt(amt)} ORL`, "neg", "Just now");
  save(); render(); renderHistory(); reward(0,"Withdrawal requested", `${naira(net)} to ${selectedName} within 24h.`);
});

document.querySelectorAll(".stake-opt").forEach(o => o.addEventListener("click", () => {
  document.querySelectorAll(".stake-opt").forEach(x=>x.classList.remove("sel")); o.classList.add("sel");
}));
$("stakeBtn").addEventListener("click", () => {
  if (S.stake && now()<S.stake.until) return;
  const amount=10000; if (S.balance<amount){ toast("Need 10,000 ORL","Mine a bit more"); return; }
  const sel=document.querySelector(".stake-opt.sel"); const days=parseInt(sel.dataset.days), apy=parseInt(sel.dataset.apy);
  S.balance-=amount; S.stake={ amount, apy, until: now()+days*86400000 };
  save(); render(); addHistory("Staked ORL", `-${fmtInt(amount)} ORL`, "neg", "Just now"); renderHistory();
  toast("ORL staked", `${apy}% APY for ${days}d`);
});

$("proBtn").addEventListener("click", () => {
  // PRODUCTION: tg.openInvoice(<Stars invoice link from your backend>, cb)
  try {
    if (tg?.showConfirm) {
      tg.showConfirm("Subscribe to Orael Pro for 250 Telegram Stars / month?", (ok)=>{ if(ok) activatePro(); });
      return;
    }
  } catch(e){}
  activatePro();
});
function activatePro(){ S.pro = now()+30*86400000; save(); render(); reward(0,"Orael Pro active","2× mining, ad-free refuels, half-price withdrawals for 30 days."); }

$("copyRef").addEventListener("click", () => { navigator.clipboard?.writeText($("refCode").textContent); toast("Invite link copied","Share it anywhere"); });
$("shareRef").addEventListener("click", () => {
  const url=$("refCode").textContent, text="Mine ORL free on Orael ⛏️";
  try { if (tg) { tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent("https://"+url)}&text=${encodeURIComponent(text)}`); return; } } catch(e){}
  navigator.clipboard?.writeText("https://"+url); toast("Link copied","Share it with friends");
});

/* segmented Earn tabs */
document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on")); b.classList.add("on");
  document.querySelectorAll("[data-pane]").forEach(p=>p.hidden = p.dataset.pane!==b.dataset.seg);
}));

/* nav */
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  haptic("light");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  btn.classList.add("active"); $("screen-"+btn.dataset.screen).classList.add("active");
  document.querySelector(".scroll").scrollTo({ top:0, behavior:"smooth" });
}));

/* ========================================================================
   INIT
   ======================================================================== */
(function init(){
  const u = tg?.initDataUnsafe?.user;
  if (u) { const i=(u.first_name||"A")[0].toUpperCase(); $("userAv").textContent=i; const lb=$("lbAv"); if(lb)lb.textContent=i; }
  if (tg) { document.documentElement.style.setProperty("--safe-top",(tg.safeAreaInset?.top||0)+"px"); document.documentElement.style.setProperty("--safe-bot",(tg.safeAreaInset?.bottom||0)+"px"); }
  buildWheel(); renderHistory(); renderTasks(); renderStreak(); renderLeaderboard(); renderFeatured(); renderPartners(); setupOfferFilters(); startLiveFeed(); render();
  setInterval(()=>{ save(); render(); }, 1000);
})();
