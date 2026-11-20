import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const payloadSchema = z.object({
  email: z.string().trim().email('Email tidak valid.'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
  name: z.string().trim().min(1, 'Nama wajib diisi.'),
  role: z.enum(['admin', 'teacher', 'student']),
  classId: z.string().optional(),
  nis: z.string().optional()
});

const reply = (statusCode, payload) => ({ statusCode, headers, body: JSON.stringify(payload) });

function getAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi di Netlify.');
    initializeApp({
      credential: cert(JSON.parse(raw)),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'ujian-harian-e6f7c'
    });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Metode tidak diizinkan.' });

  try {
    const token = /^Bearer\s+(.+)$/i.exec(event.headers.authorization || event.headers.Authorization || '')?.[1];
    if (!token) return reply(401, { error: 'Token autentikasi tidak ada.' });

    const { auth, db } = getAdmin();
    const caller = await auth.verifyIdToken(token);
    if (caller.role !== 'admin') return reply(403, { error: 'Hanya admin yang bisa membuat akun.' });

    const callerDoc = await db.collection('users').doc(caller.uid).get();
    if (!callerDoc.exists || callerDoc.data().active !== true) {
      return reply(403, { error: 'Akun admin tidak aktif.' });
    }

    const parsed = payloadSchema.safeParse(JSON.parse(event.body || '{}'));
    if (!parsed.success) return reply(400, { error: parsed.error.issues[0]?.message || 'Data tidak valid.' });
    const { email, password, name, role, classId, nis } = parsed.data;

    const created = await auth.createUser({ email, password, displayName: name });
    await auth.setCustomUserClaims(created.uid, { role });

    const now = new Date().toISOString();
    const audit = { createdAt: now, updatedAt: now, createdBy: caller.uid, updatedBy: caller.uid };
    const batch = db.batch();
    batch.set(db.collection('users').doc(created.uid), {
      uid: created.uid, email, name, role, active: true, ...audit
    });
    if (role === 'teacher') {
      batch.set(db.collection('teachers').doc(created.uid), {
        uid: created.uid, name, email, subjectIds: [], classIds: [], active: true, ...audit
      });
    }
    if (role === 'student') {
      batch.set(db.collection('students').doc(created.uid), {
        uid: created.uid, name, email, nis: nis || '', classId: classId || '', active: true, ...audit
      });
    }
    await batch.commit();

    return reply(200, { uid: created.uid, email, role });
  } catch (error) {
    const code = error?.code;
    if (code === 'auth/email-already-exists' || code === 'auth/email-already-in-use') {
      return reply(409, { error: 'Email sudah terdaftar.' });
    }
    if (code === 'auth/invalid-email') return reply(400, { error: 'Email tidak valid.' });
    if (code === 'auth/weak-password') return reply(400, { error: 'Kata sandi minimal 6 karakter.' });
    console.error('admin-accounts gagal:', code || error?.message || error);
    return reply(500, { error: 'Gagal membuat akun. Periksa log function.' });
  }
}
