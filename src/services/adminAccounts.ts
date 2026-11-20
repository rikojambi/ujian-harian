import { getFirebaseAuth } from '@/services/firebase/config';
import type { Role } from '@/types';

export interface CreateAccountInput {
  email: string;
  password: string;
  name: string;
  role: Role;
  classId?: string;
  nis?: string;
}

export async function createAccount(input: CreateAccountInput): Promise<{ uid: string; email: string; role: Role }> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error('Sesi admin berakhir. Silakan masuk ulang.');

  const response = await fetch('/.netlify/functions/admin-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });

  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try { body = JSON.parse(text) as Record<string, unknown>; } catch { /* respons bukan JSON */ }
  }
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `Gagal membuat akun (${response.status}).`);
  }
  return body as { uid: string; email: string; role: Role };
}
