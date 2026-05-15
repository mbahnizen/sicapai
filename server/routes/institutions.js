/**
 * Institution Routes
 */

import { Router } from 'express';
import { db, checkMembership, firebaseAdmin } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// GET /api/institutions — list user's institutions
router.get('/', async (req, res) => {
  try {

    const memberships = await db.collection('institution_members')
      .where('userId', '==', req.user.uid)
      .get();

    const instIds = memberships.docs.map((d) => d.data().institutionId);
    if (instIds.length === 0) return res.json([]);

    const institutions = [];
    for (const id of instIds) {
      const doc = await db.collection('institutions').doc(id).get();
      if (doc.exists) {
        institutions.push({ id: doc.id, ...doc.data() });
      }
    }

    res.json(institutions);
  } catch (error) {
    console.error('Get institutions error:', error);
    res.status(500).json({ message: 'Gagal memuat daftar instansi' });
  }
});

// POST /api/institutions — create institution
router.post('/', async (req, res) => {
  try {
    const { idempotencyKey, name, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Nama instansi wajib diisi' });

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char code

    const batch = db.batch();
    
    // Create new institution document reference (Use idempotencyKey if available, else random)
    const instRef = idempotencyKey 
      ? db.collection('institutions').doc(idempotencyKey) 
      : db.collection('institutions').doc();

    // Use merge: true so if this is a retry, it doesn't fail but just safely overwrites
    batch.set(instRef, {
      name,
      address: address || '',
      inviteCode,
      createdBy: req.user.uid,
      createdAt: new Date(),
    }, { merge: true });

    // Add creator as admin member
    const memberRef = idempotencyKey 
      ? db.collection('institution_members').doc(`${idempotencyKey}_admin_${req.user.uid}`)
      : db.collection('institution_members').doc();
      
    batch.set(memberRef, {
      institutionId: instRef.id,
      userId: req.user.uid,
      role: 'admin',
      joinedAt: new Date(),
    }, { merge: true });

    // Commit both writes atomically
    await batch.commit();

    res.status(201).json({
      id: instRef.id,
      name,
      address: address || '',
      inviteCode,
    });
  } catch (error) {
    console.error('Create institution error:', error);
    res.status(500).json({ message: 'Gagal membuat instansi' });
  }
});

// POST /api/institutions/join — join via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ message: 'Kode undangan wajib diisi' });


    const snap = await db.collection('institutions')
      .where('inviteCode', '==', inviteCode.toUpperCase())
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: 'Kode undangan tidak ditemukan' });
    }

    const instDoc = snap.docs[0];

    // Check if already member
    const existing = await db.collection('institution_members')
      .where('institutionId', '==', instDoc.id)
      .where('userId', '==', req.user.uid)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ message: 'Anda sudah tergabung di instansi ini' });
    }

    await db.collection('institution_members').add({
      institutionId: instDoc.id,
      userId: req.user.uid,
      role: 'member',
      joinedAt: new Date(),
    });

    res.json({ id: instDoc.id, ...instDoc.data() });
  } catch (error) {
    console.error('Join institution error:', error);
    res.status(500).json({ message: 'Gagal bergabung ke instansi' });
  }
});

// GET /api/institutions/:id/students — list students in institution
router.get('/:id/students', async (req, res) => {
  try {
    const isMember = await checkMembership(req.user.uid, req.params.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }
    const snap = await db.collection('students')
      .where('institutionId', '==', req.params.id)
      // .orderBy('name') // Dihapus untuk mencegah error index Firestore
      .get();

    const students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Sort in memory (lebih aman tanpa config index tambahan di Firestore)
    students.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Gagal memuat daftar siswa' });
  }
});
// GET /api/institutions/:id/details — get detailed institution info including members
router.get('/:id/details', async (req, res) => {
  try {
    const isMember = await checkMembership(req.user.uid, req.params.id);
    if (!isMember) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const instDoc = await db.collection('institutions').doc(req.params.id).get();
    if (!instDoc.exists) {
      return res.status(404).json({ message: 'Instansi tidak ditemukan' });
    }

    const institution = { id: instDoc.id, ...instDoc.data() };

    // Fetch members
    const memberSnap = await db.collection('institution_members')
      .where('institutionId', '==', req.params.id)
      .get();

    const membersData = memberSnap.docs.map(d => d.data());
    const uids = membersData.map(m => { return { uid: m.userId }; });

    // Fetch user profiles from Firebase Auth
    let authUsers = [];
    if (uids.length > 0) {
      try {
        const result = await firebaseAdmin.auth().getUsers(uids);
        authUsers = result.users;
      } catch (err) {
        console.warn('Could not fetch user profiles from auth:', err.message);
      }
    }

    // Combine member roles with auth profiles
    const members = membersData.map(m => {
      const authUser = authUsers.find(u => u.uid === m.userId);
      return {
        uid: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: authUser?.displayName || 'Unknown User',
        email: authUser?.email || '',
        photoURL: authUser?.photoURL || ''
      };
    });

    res.json({ ...institution, members });
  } catch (error) {
    console.error('Get institution details error:', error);
    res.status(500).json({ message: 'Gagal memuat detail instansi' });
  }
});

// PUT /api/institutions/:id — update institution name/address (creator only)
router.put('/:id', async (req, res) => {
  try {
    const instRef = db.collection('institutions').doc(req.params.id);
    const instDoc = await instRef.get();

    if (!instDoc.exists) {
      return res.status(404).json({ message: 'Instansi tidak ditemukan' });
    }
    if (instDoc.data().createdBy !== req.user.uid) {
      return res.status(403).json({ message: 'Akses ditolak: Hanya pembuat yang dapat mengedit instansi' });
    }

    const { name, address } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nama instansi wajib diisi' });
    }

    await instRef.update({ name: name.trim(), address: (address || '').trim() });
    res.json({ id: req.params.id, name: name.trim(), address: (address || '').trim() });
  } catch (error) {
    console.error('Update institution error:', error);
    res.status(500).json({ message: 'Gagal memperbarui instansi' });
  }
});

// DELETE /api/institutions/:id/leave — member leaves institution (non-creator only)
router.delete('/:id/leave', async (req, res) => {
  try {
    const instDoc = await db.collection('institutions').doc(req.params.id).get();
    if (!instDoc.exists) {
      return res.status(404).json({ message: 'Instansi tidak ditemukan' });
    }
    if (instDoc.data().createdBy === req.user.uid) {
      return res.status(403).json({ message: 'Admin tidak bisa keluar dari instansi. Hapus instansi jika tidak diperlukan.' });
    }

    const memberSnap = await db.collection('institution_members')
      .where('institutionId', '==', req.params.id)
      .where('userId', '==', req.user.uid)
      .limit(1)
      .get();

    if (memberSnap.empty) {
      return res.status(404).json({ message: 'Anda bukan anggota instansi ini' });
    }

    await memberSnap.docs[0].ref.delete();
    res.json({ message: 'Berhasil keluar dari instansi' });
  } catch (error) {
    console.error('Leave institution error:', error);
    res.status(500).json({ message: 'Gagal keluar dari instansi' });
  }
});

// DELETE /api/institutions/:id — delete institution
router.delete('/:id', async (req, res) => {
  try {
    const instRef = db.collection('institutions').doc(req.params.id);
    const instDoc = await instRef.get();

    if (!instDoc.exists) {
      return res.status(404).json({ message: 'Instansi tidak ditemukan' });
    }

    // Only the creator can delete the institution
    if (instDoc.data().createdBy !== req.user.uid) {
      return res.status(403).json({ message: 'Akses ditolak: Hanya pembuat yang dapat menghapus instansi ini' });
    }

    const batch = db.batch();
    batch.delete(instRef);

    // Delete associated members
    const memberSnap = await db.collection('institution_members')
      .where('institutionId', '==', req.params.id)
      .get();
      
    memberSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({ message: 'Instansi berhasil dihapus' });
  } catch (error) {
    console.error('Delete institution error:', error);
    res.status(500).json({ message: 'Gagal menghapus instansi' });
  }
});

export default router;
