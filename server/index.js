import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

import { initDB, checkAndRunDraws, getUser, updateUser, addTransaction } from './db.js';
import verifyTelegramInitData from './auth.js';
import { generalLimit, actionLimit } from './middleware/rateLimit.js';

// Route Imports
import userRoutes from './routes/user.js';
import miningRoutes from './routes/mining.js';
import playRoutes from './routes/play.js';
import earnRoutes from './routes/earn.js';
import walletRoutes from './routes/wallet.js';
import leaderboardRoutes from './routes/leaderboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Configure CORS
const DOMAIN = process.env.DOMAIN || 'https://yorubacinemax.xyz';
app.use(cors({
  origin: [DOMAIN, 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Adsgram callback verification endpoint (public)
app.get('/api/adsgram-callback', async (req, res) => {
  const { blockId, userId, reward, hash, secret } = req.query;
  const configuredSecret = process.env.ADSGRAM_SECRET || 'your_adsgram_secret_here';

  // 1. Check if verifying via simple secret token (standard Adsgram dashboard integration)
  if (secret && secret === configuredSecret) {
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }
    
    try {
      const dbUser = await getUser(userId);
      if (dbUser) {
        const rewardAmount = parseInt(reward) || 50; 
        dbUser.balance += rewardAmount;
        await addTransaction(dbUser.id, 'ad', rewardAmount, 'Adsgram ad reward');
        await updateUser(dbUser);
        console.log(`[Adsgram Callback] Successfully credited ${rewardAmount} ORL to user ${userId} via secret token`);
      } else {
        console.warn(`[Adsgram Callback] User ${userId} not found in database`);
      }
    } catch (dbErr) {
      console.error('[Adsgram Callback] Database error:', dbErr);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.json({ success: true, message: 'Reward verified and credited successfully via secret' });
  }

  // 2. Check if verifying via cryptographic hash (placeholder/anti-cheat signature)
  if (hash) {
    if (!blockId || !userId || !reward) {
      return res.status(400).json({ error: 'Missing required parameters for signature verification' });
    }

    // Calculate hash: sha256(blockId:userId:reward:configuredSecret)
    const computedHash = crypto
      .createHash('sha256')
      .update(`${blockId}:${userId}:${reward}:${configuredSecret}`)
      .digest('hex');

    if (hash !== computedHash) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    try {
      const dbUser = await getUser(userId);
      if (dbUser) {
        const rewardAmount = parseInt(reward) || 50; 
        dbUser.balance += rewardAmount;
        await addTransaction(dbUser.id, 'ad', rewardAmount, 'Adsgram ad reward');
        await updateUser(dbUser);
        console.log(`[Adsgram Callback] Successfully credited ${rewardAmount} ORL to user ${userId} via signature`);
      } else {
        console.warn(`[Adsgram Callback] User ${userId} not found in database`);
      }
    } catch (dbErr) {
      console.error('[Adsgram Callback] Database error:', dbErr);
      return res.status(500).json({ error: 'Database error' });
    }

    return res.json({ success: true, message: 'Reward verified and credited successfully via signature' });
  }

  return res.status(400).json({ error: 'Missing verification credentials (hash or secret)' });
});

// Mount Routes (auth is applied as middleware, meaning initData is required)
app.use('/api/user', verifyTelegramInitData, generalLimit, userRoutes);
app.use('/api/mining', verifyTelegramInitData, generalLimit, actionLimit, miningRoutes);
app.use('/api/play', verifyTelegramInitData, generalLimit, actionLimit, playRoutes);
app.use('/api/earn', verifyTelegramInitData, generalLimit, actionLimit, earnRoutes);
app.use('/api/wallet', verifyTelegramInitData, generalLimit, actionLimit, walletRoutes);
app.use('/api/leaderboard', verifyTelegramInitData, generalLimit, leaderboardRoutes);

// In production, serve static front-end assets
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  
  // Catch-all route to serve the built index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database then start listening
async function startServer() {
  try {
    console.log('Initializing Orael Database...');
    await initDB();
    console.log('Database initialized successfully.');

    console.log('Checking lottery draws...');
    checkAndRunDraws();

    app.listen(PORT, () => {
      console.log(`\n🚀 Orael server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Domain: ${DOMAIN}`);
      console.log(`   Database Path: data/orael.db\n`);
    });
  } catch (error) {
    console.error('Failed to start Orael server:', error);
    process.exit(1);
  }
}

startServer();
