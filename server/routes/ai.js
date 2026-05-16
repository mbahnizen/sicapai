/**
 * AI Routes — POST /api/generate-ai
 */

import { Router } from 'express';
import { generateAINarrative } from '../services/gemini.js';
import { checkQuota, deductQuota } from '../services/quota.js';
import { db } from '../middleware/auth.js';

const router = Router();

async function hasAnyMembership(uid) {
  const snap = await db.collection('institution_members')
    .where('userId', '==', uid)
    .limit(1)
    .get();
  return !snap.empty;
}

router.post('/', async (req, res) => {
  try {
    const { ageGroup, semester, templateNarrative, levelProfile } = req.body;

    if (!templateNarrative || Object.keys(templateNarrative).length === 0) {
      return res.status(400).json({ message: 'Template narasi wajib diisi' });
    }

    // Require institution membership — prevents throwaway accounts from burning quota
    const isMember = await hasAnyMembership(req.user.uid);
    if (!isMember) {
      return res.status(403).json({ message: 'Anda belum bergabung dengan instansi manapun.' });
    }

    // Check quota before the expensive AI call
    const quotaOk = await checkQuota(req.user.uid);
    if (!quotaOk) {
      return res.status(429).json({
        message: 'Kuota AI mingguan Anda sudah habis (20x/minggu). Kuota akan direset minggu depan.',
      });
    }

    // Generate AI narrative — deduct only after success so a mid-request
    // page refresh or Gemini error doesn't silently burn the user's quota.
    const narrative = await generateAINarrative({
      ageGroup,
      semester,
      templateNarrative,
      levelProfile,
    });

    await deductQuota(req.user.uid);

    res.json({ narrative });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ message: 'Gagal generate narasi AI. Silakan coba lagi.' });
  }
});

export default router;
