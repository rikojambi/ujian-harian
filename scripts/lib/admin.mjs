import { config as loadEnv } from 'dotenv';
import { cert, applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

loadEnv();

function resolveProjectId() {
  return process.env.FIREBASE_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.VITE_FIREBASE_PROJECT_ID
    || '';
}

function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return cert(JSON.parse(raw));
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON bukan JSON yang valid: ${error.message}`);
    }
  }
  return applicationDefault();
}

export function initAdmin() {
  const projectId = resolveProjectId();
  if (!projectId) throw new Error('Tentukan FIREBASE_PROJECT_ID atau VITE_FIREBASE_PROJECT_ID di .env.');
  if (!getApps().length) {
    initializeApp({ credential: credential(), projectId });
  }
  return { auth: getAuth(), db: getFirestore(), projectId };
}

export function stamp(actorId = 'admin-script') {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now, createdBy: actorId, updatedBy: actorId };
}

export function updated(actorId = 'admin-script') {
  return { updatedAt: new Date().toISOString(), updatedBy: actorId };
}

export async function findUid(auth, identifier) {
  if (!identifier) throw new Error('Berikan UID atau email.');
  if (identifier.includes('@')) return (await auth.getUserByEmail(identifier)).uid;
  return (await auth.getUser(identifier)).uid;
}

export async function setRoleClaim(auth, uid, role) {
  await auth.setCustomUserClaims(uid, { role });
}

export function requireArgs(args, count, usage) {
  if (args.length < count) {
    console.error(`Penggunaan: ${usage}`);
    process.exit(1);
  }
}
