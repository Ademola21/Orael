import { Router } from 'express';
import {
  WHEEL_PRIZES,
  WHEEL_WEIGHTS,
  SCRATCH_PRIZES,
  SCRATCH_WEIGHTS,
  CHEST_GOAL,
  CHEST_REWARD_MIN,
  CHEST_REWARD_MAX,
  LOTTO_TICKET_ORL,
} from '../economy.js';
import {
  getUser,
  updateUser,
  addTransaction,
  getLotteryPool,
  upsertLotteryPool,
} from '../db.js';
import { accrueMinedORL } from '../services/mining.js';
import { getUserState } from './user.js';

const router = Router();

/* ─── helpers ─────────────────────────────────────────────────────── */

function weightedRandom(prizes, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * sum;
  for (let i = 0; i < prizes.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return prizes[i];
  }
  return prizes[prizes.length - 1];
}

function weightedRandomIndex(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return i;
  }
  return weights.length - 1;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ─── POST /spin ──────────────────────────────────────────────────── */

router.post('/spin', async (req, res) => {
  try {
    const telegramUser = req.user;
    let user = await getUser(telegramUser.id);
    await accrueMinedORL(user);

    // Daily reset
    if (user.spin_date !== todayStr()) {
      user.spin_free_used = 0;
      user.spin_date = todayStr();
      await updateUser(user);
      user = await getUser(telegramUser.id);
    }

    const prizeIndex = weightedRandomIndex(WHEEL_WEIGHTS);
    const prizeAmount = WHEEL_PRIZES[prizeIndex];
    user.spin_free_used += 1;

    if (prizeAmount > 0) {
      user.balance += prizeAmount;
      await addTransaction(user.id, 'spin', prizeAmount, 'Spin the Wheel reward');
    }

    await updateUser(user);
    return res.json({
      prizeIndex,
      prizeAmount,
      user: await getUserState(telegramUser.id)
    });
  } catch (err) {
    console.error('POST /spin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ─── POST /scratch ───────────────────────────────────────────────── */

router.post('/scratch', async (req, res) => {
  try {
    const telegramUser = req.user;
    let user = await getUser(telegramUser.id);
    await accrueMinedORL(user);

    // Daily reset
    if (user.scratch_date !== todayStr()) {
      user.scratch_left = 3;
      user.scratch_date = todayStr();
      await updateUser(user);
      user = await getUser(telegramUser.id);
    }

    if (user.scratch_left <= 0) {
      return res.status(400).json({ error: 'No scratch cards left today' });
    }

    const prizeIndex = weightedRandomIndex(SCRATCH_WEIGHTS);
    const prizeAmount = SCRATCH_PRIZES[prizeIndex];
    user.scratch_left -= 1;

    if (prizeAmount > 0) {
      user.balance += prizeAmount;
      await addTransaction(user.id, 'scratch', prizeAmount, 'Scratch card reward');
    }

    await updateUser(user);
    return res.json({
      prizeIndex,
      prizeAmount,
      user: await getUserState(telegramUser.id)
    });
  } catch (err) {
    console.error('POST /scratch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ─── POST /chest ─────────────────────────────────────────────────── */

router.post('/chest', async (req, res) => {
  try {
    const telegramUser = req.user;
    let user = await getUser(telegramUser.id);
    await accrueMinedORL(user);

    user.chest_progress = (user.chest_progress || 0) + 1;

    if (user.chest_progress >= CHEST_GOAL) {
      user.chest_progress = 0;
      const reward =
        Math.floor(Math.random() * (CHEST_REWARD_MAX - CHEST_REWARD_MIN + 1)) +
        CHEST_REWARD_MIN;
      user.balance += reward;
      await addTransaction(user.id, 'chest', reward, 'Treasure chest reward');
      await updateUser(user);
      return res.json({
        chestOpened: true,
        prizeAmount: reward,
        user: await getUserState(telegramUser.id),
      });
    }

    await updateUser(user);
    return res.json({
      chestOpened: false,
      progress: user.chest_progress,
      user: await getUserState(telegramUser.id),
    });
  } catch (err) {
    console.error('POST /chest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ─── POST /lottery/ticket ────────────────────────────────────────── */

router.post('/lottery/ticket', async (req, res) => {
  try {
    const telegramUser = req.user;
    const { type } = req.body;
    let user = await getUser(telegramUser.id);
    await accrueMinedORL(user);

    // Daily reset
    if (user.lotto_date !== todayStr()) {
      user.lotto_tickets = 0;
      user.lotto_date = todayStr();
      await updateUser(user);
      user = await getUser(telegramUser.id);
    }

    if (type === 'buy') {
      if (user.balance < LOTTO_TICKET_ORL) {
        return res
          .status(400)
          .json({ error: 'Insufficient balance for lottery ticket' });
      }
      user.balance -= LOTTO_TICKET_ORL;
      await addTransaction(
        user.id,
        'lottery_buy',
        -LOTTO_TICKET_ORL,
        'Lottery ticket purchase',
      );
    }

    user.lotto_tickets += 1;

    await upsertLotteryPool(todayStr(), LOTTO_TICKET_ORL, 1);
    await updateUser(user);

    const pool = await getLotteryPool(todayStr());
    return res.json({
      tickets: user.lotto_tickets,
      pool,
      user: await getUserState(telegramUser.id),
    });
  } catch (err) {
    console.error('POST /lottery/ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ─── GET /lottery/status ─────────────────────────────────────────── */

router.get('/lottery/status', async (req, res) => {
  try {
    const telegramUser = req.user;
    const user = await getUser(telegramUser.id);
    const pool = await getLotteryPool(todayStr());

    return res.json({
      pool,
      userTickets: user.lotto_date === todayStr() ? user.lotto_tickets : 0,
    });
  } catch (err) {
    console.error('GET /lottery/status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
