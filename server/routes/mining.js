import { Router } from 'express';
import {
  getUser,
  updateUser,
  addTransaction
} from '../db.js';
import { accrueMinedORL } from '../services/mining.js';
import { getUserState } from './user.js';
import { TANK_ORL, RIGS, SESSION_MS } from '../economy.js';

const router = Router();

// POST /api/mining/refuel
router.post('/refuel', async (req, res) => {
  try {
    const telegramUser = req.telegramUser;
    let user = getUser(telegramUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Accrue first
    await accrueMinedORL(user);
    user = getUser(telegramUser.id); // re-fetch

    // Calculate energy %
    const energy = ((TANK_ORL - user.tank_mined) / TANK_ORL) * 100;
    if (energy >= 95) {
      return res.status(400).json({ error: 'Engine fuel level is already full' });
    }

    // Reset tank
    updateUser(user.id, {
      tank_mined: 0,
      last_accrue_at: Date.now()
    });

    const state = await getUserState(telegramUser.id);
    return res.json(state);
  } catch (err) {
    console.error('POST /refuel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/mining/boost
router.post('/boost', async (req, res) => {
  try {
    const telegramUser = req.telegramUser;
    let user = getUser(telegramUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Accrue first
    await accrueMinedORL(user);
    user = getUser(telegramUser.id);

    const now = Date.now();
    // Validate not already boosted
    if (user.boost_until > now) {
      return res.status(400).json({ error: 'Boost is already active' });
    }

    // Validate mining is active (tank is not completely mined and last_accrue_at exists)
    if (user.tank_mined >= TANK_ORL) {
      return res.status(400).json({ error: 'Mining engine is idle. Refuel first.' });
    }

    updateUser(user.id, {
      boost_until: now + SESSION_MS
    });

    const state = await getUserState(telegramUser.id);
    return res.json(state);
  } catch (err) {
    console.error('POST /boost error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/mining/rig-upgrade
router.post('/rig-upgrade', async (req, res) => {
  try {
    const telegramUser = req.telegramUser;
    let user = getUser(telegramUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Accrue first
    await accrueMinedORL(user);
    user = getUser(telegramUser.id);

    const nextLevel = user.rig_level + 1;
    if (nextLevel >= RIGS.length) {
      return res.status(400).json({ error: 'Already at maximum rig level' });
    }

    const nextRig = RIGS[nextLevel];
    if (user.balance < nextRig.cost) {
      return res.status(400).json({ error: 'Insufficient balance to purchase this rig' });
    }

    const newBalance = user.balance - nextRig.cost;
    updateUser(user.id, {
      balance: newBalance,
      rig_level: nextLevel
    });

    addTransaction(user.id, 'upgrade', -nextRig.cost, `Upgraded to ${nextRig.name}`);

    const state = await getUserState(telegramUser.id);
    return res.json(state);
  } catch (err) {
    console.error('POST /rig-upgrade error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
