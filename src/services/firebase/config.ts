import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;
let storageEmulatorConnected = false;

function emulatorEndpoint(value: string | undefined, fallback: string): { host: string; port: number } {
  try {
    const url = new URL(value || fallback);
    return { host: url.hostname, port: Number(url.port) || 80 };
  } catch {
    const [host, port] = fallback.replace(/^https?:\/\//, '').split(':');
    return { host, port: Number(port) || 80 };
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error('Firebase belum dikonfigurasi. Isi file .env terlebih dahulu.');
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (env.VITE_USE_FIREBASE_EMULATOR === 'true' && !authEmulatorConnected) {
      connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_HOST || 'http://127.0.0.1:9099', { disableWarnings: true });
      authEmulatorConnected = true;
    }
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
    if (env.VITE_USE_FIREBASE_EMULATOR === 'true' && !firestoreEmulatorConnected) {
      const { host, port } = emulatorEndpoint(env.VITE_FIREBASE_EMULATOR_HOST as string | undefined, 'http://127.0.0.1:8085');
      connectFirestoreEmulator(db, host, port);
      firestoreEmulatorConnected = true;
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
    if (env.VITE_USE_FIREBASE_EMULATOR === 'true' && !storageEmulatorConnected) {
      connectStorageEmulator(storage, '127.0.0.1', 9199);
      storageEmulatorConnected = true;
    }
  }
  return storage;
}
