import { Router } from 'express';
import {
  getUser,
  updateUser,
  addTransaction
} from '../db.js';
import { accrueMinedORL } from '../services/mining.js';
import { getUserState } from './user.js';

const router = Router();



// POST /api/wallet/pro
router.post('/pro', async (req, res) => {
  try {
    const telegramUser = req.telegramUser;
    let user = getUser(telegramUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = process.env.BOT_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Telegram Bot token is not configured on the server' });
    }

    const invoiceData = {
      title: 'Orael Pro Subscription',
      description: 'Unlock 2× mining rate, ad-free refuels, and priority payouts for 30 days.',
      payload: `pro_subscription:${user.id}`,
      provider_token: '', // Must be empty for Telegram Stars
      currency: 'XTR',    // XTR is the currency code for Telegram Stars
      prices: [
        { label: 'Orael Pro (30 Days)', amount: 250 } // 250 Stars
      ]
    };

    const teleRes = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });
    const data = await teleRes.json();

    if (!data.ok) {
      console.error('[payment] createInvoiceLink failed:', data);
      return res.status(500).json({ error: 'Failed to generate Stars payment link from Telegram API' });
    }

    return res.json({ success: true, invoiceLink: data.result });
  } catch (err) {
    console.error('POST /pro error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/wallet/withdraw
router.post('/withdraw', (req, res) => {
  return res.json({ success: false, message: 'Withdrawals coming soon. Stay tuned!' });
});

export default router;
