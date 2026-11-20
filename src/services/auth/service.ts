import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signOut as firebaseSignOut, updateProfile
} from 'firebase/auth';
import { getFirebaseAuth } from '@/services/firebase/config';
import { db, isLocalMode } from '@/services/db';
import type { Role } from '@/types';
import { nanoid } from '@/utils/id';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

interface LocalCredential {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  role: Role;
}

const SESSION_KEY = 'ujian-harian-session';

export async function digest(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const authService = {
  async signIn(email: string, password: string): Promise<AuthUser> {
    if (!isLocalMode) {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      return {
        uid: credential.user.uid,
        email: credential.user.email ?? email,
        displayName: credential.user.displayName ?? email.split('@')[0]
      };
    }
    const normalized = email.trim().toLowerCase();
    const found = (await db.list<LocalCredential>('credentials', { filters: [{ field: 'email', op: '==', value: normalized }] }))[0];
    if (!found || (await digest(password, found.salt)) !== found.passwordHash) {
      throw new Error('Email atau kata sandi salah.');
    }
    const user = { uid: found.uid, email: found.email, displayName: found.displayName };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, role: found.role }));
    return user;
  },

  async signUp(email: string, password: string, displayName: string, role: Role = 'student', persistSession = true): Promise<AuthUser> {
    const previousSession = localStorage.getItem(SESSION_KEY);
    if (!isLocalMode) {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      // Firebase Auth akan beralih ke akun baru; sesi admin dipulihkan oleh pemanggil bila perlu.
      await updateProfile(credential.user, { displayName });
      return { uid: credential.user.uid, email: credential.user.email ?? email, displayName };
    }
    const normalized = email.trim().toLowerCase();
    const existing = await db.list<LocalCredential>('credentials', { filters: [{ field: 'email', op: '==', value: normalized }] });
    if (existing.length) throw new Error('Email sudah terdaftar.');
    if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter.');
    const salt = nanoid(16);
    const uid = nanoid(20);
    await db.create('credentials', {
      uid, email: normalized, displayName, salt,
      passwordHash: await digest(password, salt), role,
      createdAt: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    const user = { uid, email: normalized, displayName };
    if (persistSession) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, role }));
    else if (previousSession) localStorage.setItem(SESSION_KEY, previousSession);
    return user;
  },

  async signOut(): Promise<void> {
    if (!isLocalMode) await firebaseSignOut(getFirebaseAuth());
    localStorage.removeItem(SESSION_KEY);
  },

  currentUser(): AuthUser | null {
    if (!isLocalMode) {
      const user = getFirebaseAuth().currentUser;
      return user ? { uid: user.uid, email: user.email ?? '', displayName: user.displayName ?? '' } : null;
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  localRole(): Role | undefined {
    if (!isLocalMode) return undefined;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    try {
      return (JSON.parse(raw) as { role?: Role }).role;
    } catch {
      return undefined;
    }
  },

  onChange(callback: (user: AuthUser | null) => void): () => void {
    if (!isLocalMode) return onAuthStateChanged(getFirebaseAuth(), (user) => {
      callback(user ? { uid: user.uid, email: user.email ?? '', displayName: user.displayName ?? '' } : null);
    });
    const handler = () => callback(authService.currentUser());
    window.addEventListener('storage', handler);
    window.addEventListener('ujian-harian:auth', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ujian-harian:auth', handler);
    };
  },

  notifyLocalAuthChange(): void {
    if (isLocalMode) window.dispatchEvent(new Event('ujian-harian:auth'));
  }
};
