import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'orael.db');

let db = null;
let SQL = null;

/**
 * Initialize the pure-JS SQLite database.
 * Auto-creates tables and schemas. Must be called before server start.
 */
export async function initDB() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id     INTEGER UNIQUE NOT NULL,
      first_name      TEXT,
      last_name       TEXT,
      username        TEXT,
      balance         REAL    DEFAULT 0,
      rig_level       INTEGER DEFAULT 0,
      tank_mined      REAL    DEFAULT 0,
      last_accrue_at  INTEGER,
      boost_until     INTEGER DEFAULT 0,
      pro_until       INTEGER DEFAULT 0,
      faucet_last     INTEGER DEFAULT 0,
      streak_day      INTEGER DEFAULT 1,
      streak_last_date TEXT,
      spin_date       TEXT,
      spin_free_used  INTEGER DEFAULT 0,
      scratch_date    TEXT,
      scratch_left    INTEGER DEFAULT 3,
      chest_progress  INTEGER DEFAULT 0,
      lotto_date      TEXT,
      lotto_tickets   INTEGER DEFAULT 0,
      referral_code   TEXT UNIQUE,
      referred_by     INTEGER,
      ref_count       INTEGER DEFAULT 0,
      ref_earnings    REAL    DEFAULT 0,
      ref_active      INTEGER DEFAULT 0,
      tier            INTEGER DEFAULT 1,
      country         TEXT,
      banned          INTEGER DEFAULT 0,
      created_at      INTEGER,
      updated_at      INTEGER
    );
  `);

  // Migration: Add country column if table already exists
  try {
    db.run("ALTER TABLE users ADD COLUMN country TEXT;");
  } catch (e) {
    // Column already exists or table doesn't exist yet (handled silently)
  }

  // Migration: Add banned column if table already exists
  try {
    db.run("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists or table doesn't exist yet (handled silently)
  }



  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      type        TEXT,
      amount      REAL,
      description TEXT,
      created_at  INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS completed_tasks (
      user_id      INTEGER NOT NULL,
      task_id      TEXT    NOT NULL,
      completed_at INTEGER,
      PRIMARY KEY (user_id, task_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lottery_pools (
      draw_date     TEXT PRIMARY KEY,
      total_pool    REAL    DEFAULT 0,
      total_tickets INTEGER DEFAULT 0,
      winner_id     INTEGER,
      drawn         INTEGER DEFAULT 0,
      created_at    INTEGER
    );
  `);

  // Create Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_completed_tasks_user ON completed_tasks(user_id);`);

  saveDB();
  return db;
}

/**
 * Persist the database state to disk.
 */
export function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Get active db instance.
 */
export function getDB() {
  return db;
}

/* ─── Query execution helpers ─────────────────────────────────────── */

export function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let res = undefined;
  if (stmt.step()) {
    res = stmt.getAsObject();
  }
  stmt.free();
  return res;
}

export function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  if (Array.isArray(params)) {
    stmt.bind(params);
  } else if (params && typeof params === 'object') {
    const boundParams = {};
    for (const key of Object.keys(params)) {
      if (key.startsWith('@') || key.startsWith('$') || key.startsWith(':')) {
        boundParams[key] = params[key];
      } else {
        boundParams[`@${key}`] = params[key];
        boundParams[`$${key}`] = params[key];
        boundParams[`:${key}`] = params[key];
      }
    }
    stmt.bind(boundParams);
  }
  stmt.step();
  stmt.free();

  const lastIdRes = db.exec("SELECT last_insert_rowid() AS id, changes() AS changes");
  const lastInsertRowid = lastIdRes[0].values[0][0];
  const changes = lastIdRes[0].values[0][1];

  saveDB();

  console.log("DEBUG run lastIdRes:", JSON.stringify(lastIdRes));
  return { lastInsertRowid, changes };
}

/* ─── Business Logic DB Helpers ───────────────────────────────────── */

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function getUser(telegramId) {
  return getOne('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
}

export function getUserById(id) {
  return getOne('SELECT * FROM users WHERE id = ?', [id]);
}

export function calculateUserTier(user) {
  const balance = user.balance || 0;
  const refCount = user.ref_count || 0;

  if (balance >= 500000 || refCount >= 100) return 5;
  if (balance >= 100000 || refCount >= 25) return 4;
  if (balance >= 25000 || refCount >= 10) return 3;
  if (balance >= 5000 || refCount >= 3) return 2;
  return 1;
}

export function checkTierUpgrade(user) {
  const currentTier = user.tier || 1;
  const newTier = calculateUserTier(user);
  if (newTier > currentTier) {
    run('UPDATE users SET tier = ? WHERE id = ?', [newTier, user.id]);
    addTransaction(user.id, 'tier_up', 0, `Leveled up to Tier ${newTier}!`);
    user.tier = newTier;
    return true;
  }
  return false;
}

export function createUser(telegramId, firstName, lastName, username, referralCode, referredByCode, country) {
  const nowTime = Date.now();
  const code = referralCode || generateReferralCode();
  let referredBy = null;

  if (referredByCode) {
    const referrer = getOne('SELECT * FROM users WHERE referral_code = ?', [referredByCode]);
    if (referrer) {
      referredBy = referrer.id;
      run('UPDATE users SET ref_count = ref_count + 1, updated_at = ? WHERE id = ?', [nowTime, referrer.id]);
    }
  }

  const info = run(`
    INSERT INTO users (telegram_id, first_name, last_name, username, referral_code, referred_by, last_accrue_at, country, created_at, updated_at)
    VALUES (@telegram_id, @first_name, @last_name, @username, @referral_code, @referred_by, @last_accrue_at, @country, @created_at, @updated_at)
  `, {
    telegram_id: telegramId,
    first_name: firstName || null,
    last_name: lastName || null,
    username: username || null,
    referral_code: code,
    referred_by: referredBy,
    last_accrue_at: nowTime,
    country: country || null,
    created_at: nowTime,
    updated_at: nowTime
  });

  return getUserById(info.lastInsertRowid);
}

export function updateUser(id, fields) {
  let actualId = id;
  let actualFields = fields;

  if (typeof id === 'object' && id !== null && id.id && !fields) {
    actualId = id.id;
    actualFields = { ...id };
    delete actualFields.id;
  }

  const keys = Object.keys(actualFields);
  if (keys.length === 0) return;

  const sets = keys.map(k => `${k} = @${k}`);
  sets.push('updated_at = @updated_at');

  const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = @id`;
  return run(sql, { ...actualFields, updated_at: Date.now(), id: actualId });
}

export function addTransaction(userId, type, amount, description) {
  return run(`
    INSERT INTO transactions (user_id, type, amount, description, created_at)
    VALUES (@user_id, @type, @amount, @description, @created_at)
  `, {
    user_id: userId,
    type,
    amount,
    description: description || null,
    created_at: Date.now()
  });
}

export function getTransactions(userId, limit = 20) {
  return getAll('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
}

export function getCompletedTasks(userId) {
  const rows = getAll('SELECT task_id FROM completed_tasks WHERE user_id = ?', [userId]);
  return rows.map(r => r.task_id);
}

export function completeTask(userId, taskId) {
  return run(`
    INSERT INTO completed_tasks (user_id, task_id, completed_at)
    VALUES (?, ?, ?)
  `, [userId, taskId, Date.now()]);
}



export function getLotteryPool(date) {
  return getOne('SELECT * FROM lottery_pools WHERE draw_date = ?', [date]);
}

export function upsertLotteryPool(date, amount, tickets) {
  return run(`
    INSERT INTO lottery_pools (draw_date, total_pool, total_tickets, created_at)
    VALUES (@draw_date, @amount, @tickets, @created_at)
    ON CONFLICT(draw_date) DO UPDATE SET
      total_pool    = total_pool + @amount,
      total_tickets = total_tickets + @tickets
  `, {
    draw_date: date,
    amount,
    tickets,
    created_at: Date.now()
  });
}

/**
 * Perform drawing for a specific date pool
 */
export function drawLottery(date) {
  const pool = getLotteryPool(date);
  if (!pool || pool.drawn) return;

  console.log(`[lottery] Running draw for date: ${date}`);

  const participants = getAll('SELECT id, telegram_id, lotto_tickets FROM users WHERE lotto_date = ? AND lotto_tickets > 0', [date]);

  let winnerId = null;
  let winnerTelegramId = null;

  if (participants.length > 0) {
    const poolList = [];
    for (const p of participants) {
      for (let i = 0; i < p.lotto_tickets; i++) {
        poolList.push(p);
      }
    }

    const winner = poolList[Math.floor(Math.random() * poolList.length)];
    winnerId = winner.id;
    winnerTelegramId = winner.telegram_id;

    const prize = pool.total_pool || 0;
    if (prize > 0) {
      run('UPDATE users SET balance = balance + ? WHERE id = ?', [prize, winnerId]);
      addTransaction(winnerId, 'lottery_win', prize, `Won lottery draw for ${date}`);
      console.log(`[lottery] Winner picked: User ID ${winnerId} won ${prize} ORL`);

      // Notify winner via Bot
      try {
        const token = process.env.BOT_TOKEN;
        if (token) {
          fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: winnerTelegramId,
              text: `🎉 Congratulations! You won the Orael Lottery draw for ${date}! A prize of ${prize} ORL has been credited to your balance! 🚀`
            })
          }).catch(e => console.error('[lottery] Bot notify error:', e));
        }
      } catch (err) {
        console.error('[lottery] Failed to send win notification:', err);
      }
    }
  }

  run('UPDATE lottery_pools SET winner_id = ?, drawn = 1 WHERE draw_date = ?', [winnerId, date]);
}

/**
 * Check for any past undrawn pools and draw them
 */
export function checkAndRunDraws() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const undrawn = getAll('SELECT draw_date FROM lottery_pools WHERE drawn = 0 AND draw_date < ?', [today]);
    for (const p of undrawn) {
      drawLottery(p.draw_date);
    }
  } catch (err) {
    console.error('[lottery] checkAndRunDraws failed:', err);
  }
}

export function getLeaderboard(limit = 20) {
  return getAll('SELECT * FROM users WHERE balance > 0 ORDER BY balance DESC LIMIT ?', [limit]);
}

export function getUserRank(userId) {
  const res = getOne('SELECT COUNT(*) AS rank FROM users WHERE balance > (SELECT balance FROM users WHERE id = ?)', [userId]);
  return res ? res.rank : 0;
}

export default {
  initDB,
  saveDB,
  getDB,
  getUser,
  getUserById,
  createUser,
  updateUser,
  addTransaction,
  getTransactions,
  getCompletedTasks,
  completeTask,
  getLotteryPool,
  upsertLotteryPool,
  drawLottery,
  checkAndRunDraws,
  getLeaderboard,
  getUserRank,
  checkTierUpgrade,
  calculateUserTier
};
