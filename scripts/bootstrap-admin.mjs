import { initAdmin, setRoleClaim, stamp, updated } from './lib/admin.mjs';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@ujianharian.local';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin123!';
const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator';
const forcePassword = process.env.BOOTSTRAP_ADMIN_FORCE_PASSWORD === 'true';

if (process.env.NODE_ENV !== 'test' && (!process.env.BOOTSTRAP_ADMIN_EMAIL || !process.env.BOOTSTRAP_ADMIN_PASSWORD)) {
  console.warn('BOOTSTRAP_ADMIN_EMAIL/PASSWORD tidak diatur; memakai nilai bawaan. Ganti setelah login pertama.');
}

try {
  const { auth, db } = initAdmin();
  let authUser;
  let created = false;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch {
    authUser = await auth.createUser({ email, password, displayName: name });
    created = true;
  }
  if (!created && forcePassword) await auth.updateUser(authUser.uid, { password });

  await db.collection('users').doc(authUser.uid).set({
    uid: authUser.uid,
    email,
    name,
    role: 'admin',
    active: true,
    ...(created ? stamp('bootstrap') : updated('bootstrap'))
  }, { merge: true });
  await setRoleClaim(auth, authUser.uid, 'admin');

  console.log(`Admin siap: ${email} (${authUser.uid})`);
  if (created) console.log(`Kata sandi awal: ${password}`);
  console.log('Simpan kredensial di pengelola kata sandi dan hapus BOOTSTRAP_ADMIN_PASSWORD dari .env setelah proses selesai.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
