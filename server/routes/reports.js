/**
 * Report Routes
 */

import { Router } from 'express';
import { db, checkMembership } from '../middleware/auth.js';

const router = Router();

// POST /api/reports — save report
router.post('/', async (req, res) => {
  try {
    const { studentId, institutionId, semester, academicYear, selectedIndicators, templateNarrative, aiNarrative, studentName, studentMeta } = req.body;
    if (!studentId || !institutionId) return res.status(400).json({ message: 'Student ID dan Institution ID wajib' });

    const isMember = await checkMembership(req.user.uid, institutionId);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak: Anda bukan anggota instansi ini' });
    }

    const ref = await db.collection('reports').add({
      studentId, institutionId, semester, academicYear,
      selectedIndicators, templateNarrative, aiNarrative: aiNarrative || null,
      studentName: studentName || null,
      studentMeta: studentMeta || null,
      status: 'final',
      finalizedAt: new Date(),
      createdBy: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({ id: ref.id });
  } catch (error) {
    console.error('Save report error:', error);
    res.status(500).json({ message: 'Gagal menyimpan rapor' });
  }
});

// GET /api/reports/institution/:institutionId — latest report per student per semester
router.get('/institution/:institutionId', async (req, res) => {
  try {
    const isMember = await checkMembership(req.user.uid, req.params.institutionId);
    if (!isMember) return res.status(403).json({ message: 'Akses ditolak' });

    const snap = await db.collection('reports')
      .where('institutionId', '==', req.params.institutionId)
      .where('status', '==', 'final')
      .get();

    const allReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Keep latest finalizedAt per student+semester combo
    const latestMap = new Map();
    for (const report of allReports) {
      const key = `${report.studentId}_${report.semester}`;
      const existing = latestMap.get(key);
      const t = (r) => r?.finalizedAt?.toDate?.()?.getTime?.() ?? r?.finalizedAt?._seconds * 1000 ?? 0;
      if (!existing || t(report) > t(existing)) {
        latestMap.set(key, report);
      }
    }

    const results = Array.from(latestMap.values());
    results.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || '', 'id'));

    res.json(results);
  } catch (error) {
    console.error('Get institution reports error:', error);
    res.status(500).json({ message: 'Gagal memuat rapor instansi' });
  }
});

// GET /api/reports/:studentId
router.get('/:studentId', async (req, res) => {
  try {
    const studentRef = await db.collection('students').doc(req.params.studentId).get();
    if (!studentRef.exists) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const isMember = await checkMembership(req.user.uid, studentRef.data().institutionId);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    const snap = await db.collection('reports')
      .where('studentId', '==', req.params.studentId)
      // .orderBy('createdAt', 'desc') // Dihapus mencegah error index
      .get();

    let reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Sort & limit in JS
    reports.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
    reports = reports.slice(0, 10);
    
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Gagal memuat rapor' });
  }
});

export default router;
