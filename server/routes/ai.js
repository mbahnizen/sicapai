/**
 * AI Routes — POST /api/generate-ai
 */

import { Router } from 'express';
import { generateAINarrative } from '../services/gemini.js';
import { checkAndDeductQuota } from '../services/quota.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { ageGroup, semester, templateNarrative } = req.body;

    if (!templateNarrative || Object.keys(templateNarrative).length === 0) {
      return res.status(400).json({ message: 'Template narasi wajib diisi' });
    }

    // Check quota
    const quotaOk = await checkAndDeductQuota(req.user.uid);
    if (!quotaOk) {
      return res.status(429).json({
        message: 'Kuota AI mingguan Anda sudah habis (20x/minggu). Kuota akan direset minggu depan.',
      });
    }

    // Generate AI narrative
    const narrative = await generateAINarrative({
      ageGroup,
      semester,
      templateNarrative,
    });

    res.json({ narrative });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ message: 'Gagal generate narasi AI. Silakan coba lagi.' });
  }
});

export default router;
