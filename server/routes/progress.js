/**
 * Progress Routes — Save & load per-user per-student checklist progress
 * Stored in Firestore so it syncs across devices.
 */

import { Router } from 'express';
import { db, checkMembership } from '../middleware/auth.js';

const router = Router();

const col = () => db.collection('progress');
const docId = (uid, studentId) => `${uid}_${studentId}`;

// Helper — verify student belongs to user's institution
async function verifyStudentAccess(uid, studentId) {
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) return false;
  return checkMembership(uid, studentDoc.data().institutionId);
}

// GET /api/progress/:studentId
router.get('/:studentId', async (req, res) => {
  try {
    const hasAccess = await verifyStudentAccess(req.user.uid, req.params.studentId);
    if (!hasAccess) return res.status(403).json({ message: 'Akses ditolak' });

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
    const hasAccess = await verifyStudentAccess(req.user.uid, req.params.studentId);
    if (!hasAccess) return res.status(403).json({ message: 'Akses ditolak' });

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
    const hasAccess = await verifyStudentAccess(req.user.uid, req.params.studentId);
    if (!hasAccess) return res.status(403).json({ message: 'Akses ditolak' });

    await col().doc(docId(req.user.uid, req.params.studentId)).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete progress error:', err);
    res.status(500).json({ message: 'Gagal menghapus progress.' });
  }
});

export default router;

