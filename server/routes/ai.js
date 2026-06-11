/**
 * AI Routes — POST /api/generate-ai
 */

import { Router } from 'express';
import { generateAINarrative } from '../services/gemini.js';
import { checkAndDeductQuotaAtomic } from '../services/quota.js';
import { db } from '../middleware/auth.js';

const router = Router();

async function hasAnyMembership(uid) {
  const snap = await db.collection('institution_members')
    .where('userId', '==', uid)
    .limit(1)
    .get();
  return !snap.empty;
}

const VALID_AGE_GROUPS = new Set(['A', 'B']);
const VALID_SEMESTERS = new Set(['1', '2']);
const VALID_SECTION_IDS = new Set(['agama-budi-pekerti', 'jati-diri', 'literasi-steam', 'kokurikuler']);
const MAX_TEMPLATE_LENGTH = 8000;

function sanitizeTemplateNarrative(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const sanitized = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_SECTION_IDS.has(key)) return null;
    if (typeof value !== 'string') return null;
    // Strip null bytes and control characters (except newlines/tabs)
    const clean = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, MAX_TEMPLATE_LENGTH);
    sanitized[key] = clean;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

router.post('/', async (req, res) => {
  try {
    const { ageGroup, semester, templateNarrative, levelProfile } = req.body;

    // Strict input validation — prevents prompt injection via these fields
    if (!VALID_AGE_GROUPS.has(ageGroup)) {
      return res.status(400).json({ message: 'Kelompok usia tidak valid' });
    }
    if (!VALID_SEMESTERS.has(String(semester))) {
      return res.status(400).json({ message: 'Semester tidak valid' });
    }

    const cleanTemplate = sanitizeTemplateNarrative(templateNarrative);
    if (!cleanTemplate) {
      return res.status(400).json({ message: 'Template narasi tidak valid' });
    }

    // Require institution membership — prevents throwaway accounts from burning quota
    const isMember = await hasAnyMembership(req.user.uid);
    if (!isMember) {
      return res.status(403).json({ message: 'Anda belum bergabung dengan instansi manapun.' });
    }

    // Atomically check and deduct quota in one transaction — prevents race condition
    // where concurrent requests could bypass the weekly limit.
    const quotaOk = await checkAndDeductQuotaAtomic(req.user.uid);
    if (!quotaOk) {
      return res.status(429).json({
        message: 'Kuota AI mingguan Anda sudah habis (20x/minggu). Kuota akan direset minggu depan.',
      });
    }

    try {
      const narrative = await generateAINarrative({
        ageGroup,
        semester,
        templateNarrative: cleanTemplate,
        levelProfile,
      });
      res.json({ narrative });
    } catch (genError) {
      // Generation failed after quota was already deducted — this is acceptable:
      // the client retries count against quota to prevent abuse via intentional failures.
      console.error('AI generation error:', genError);
      res.status(500).json({ message: 'Gagal generate narasi AI. Silakan coba lagi.' });
    }
  } catch (error) {
    console.error('AI route error:', error);
    res.status(500).json({ message: 'Gagal generate narasi AI. Silakan coba lagi.' });
  }
});

export default router;
