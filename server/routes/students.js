/**
 * Student Routes
 */

import { Router } from 'express';
import { db, checkMembership } from '../middleware/auth.js';

const router = Router();

// POST /api/students — create student
router.post('/', async (req, res) => {
  try {
    const { idempotencyKey, name, nickname, gender, ageGroup, religion, institutionId } = req.body;
    if (!name || !institutionId) {
      return res.status(400).json({ message: 'Nama dan instansi wajib diisi' });
    }

    const isMember = await checkMembership(req.user.uid, institutionId);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak: Anda bukan anggota instansi ini' });
    }

    const docRef = idempotencyKey 
      ? db.collection('students').doc(idempotencyKey)
      : db.collection('students').doc();

    await docRef.set({
      name, nickname: nickname || null, gender, ageGroup, religion, institutionId,
      createdBy: req.user.uid,
      createdAt: new Date(),
    }, { merge: true });

    res.status(201).json({ id: docRef.id, name, nickname: nickname || null, gender, ageGroup, religion, institutionId });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ message: 'Gagal menambahkan siswa' });
  }
});

// PUT /api/students/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, nickname, gender, ageGroup, religion } = req.body;
    const docRef = db.collection('students').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const isMember = await checkMembership(req.user.uid, docSnap.data().institutionId);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    await docRef.update({
      name, nickname: nickname || null, gender, ageGroup, religion, updatedAt: new Date(),
    });
    res.json({ id: req.params.id, name, nickname: nickname || null, gender, ageGroup, religion });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Gagal mengupdate data siswa' });
  }
});

// DELETE /api/students/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('students').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const isMember = await checkMembership(req.user.uid, docSnap.data().institutionId);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    await docRef.delete();
    res.status(204).send();
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Gagal menghapus siswa' });
  }
});

export default router;
