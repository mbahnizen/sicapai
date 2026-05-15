/**
 * Quota Routes
 */

import { Router } from 'express';
import { getQuotaStatus } from '../services/quota.js';

const router = Router();

// GET /api/quota — check current quota
router.get('/', async (req, res) => {
  try {
    const status = await getQuotaStatus(req.user.uid);
    res.json(status);
  } catch (error) {
    console.error('Quota check error:', error);
    res.status(500).json({ message: 'Gagal memeriksa kuota' });
  }
});

export default router;
