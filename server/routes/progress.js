/**
 * Progress Routes — Save & load per-user per-student checklist progress
 * Stored in Firestore so it syncs across devices.
 */

import { Router } from 'express';
import { db } from '../middleware/auth.js';

const router = Router();

const col = () => db.collection('progress');
const docId = (uid, studentId) => `${uid}_${studentId}`;

// GET /api/progress/:studentId
router.get('/:studentId', async (req, res) => {
  try {
    const doc = await col().doc(docId(req.user.uid, req.params.studentId)).get();
    res.json(doc.exists ? doc.data() : null);
  } catch (err) {
    console.error('Load progress error:', err);
    res.status(500).json({ message: 'Gagal memuat progress.' });
  }
});

// POST /api/progress/:studentId
router.post('/:studentId', async (req, res) => {
  try {
    const { selectedIndicators, aiResult, semester, year } = req.body;
    await col().doc(docId(req.user.uid, req.params.studentId)).set({
      selectedIndicators: selectedIndicators || {},
      aiResult: aiResult || {},
      semester: semester || '1',
      year: year || '',
      savedAt: Date.now(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ message: 'Gagal menyimpan progress.' });
  }
});

// DELETE /api/progress/:studentId — reset all progress for this student
router.delete('/:studentId', async (req, res) => {
  try {
    await col().doc(docId(req.user.uid, req.params.studentId)).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete progress error:', err);
    res.status(500).json({ message: 'Gagal menghapus progress.' });
  }
});

export default router;
