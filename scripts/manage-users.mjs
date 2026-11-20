import { initAdmin, findUid, requireArgs, stamp, updated } from './lib/admin.mjs';

const [command, ...args] = process.argv.slice(2);
const ROLES = new Set(['admin', 'teacher', 'student']);

async function ensureRoleDoc(db, uid, role, profile, actorId) {
  const ref = db.collection('users').doc(uid);
  const snapshot = await ref.get();
  const base = {
    uid,
    name: profile.name,
    email: profile.email,
    role,
    active: true,
    ...(snapshot.exists ? updated(actorId) : stamp(actorId))
  };
  await ref.set(base, { merge: true });

  if (role === 'teacher') {
    await db.collection('teachers').doc(uid).set({
      uid, name: profile.name, email: profile.email,
      subjectIds: [], classIds: [], active: true,
      ...(snapshot.exists ? updated(actorId) : stamp(actorId))
    }, { merge: true });
  }
  if (role === 'student') {
    await db.collection('students').doc(uid).set({
      uid, name: profile.name, email: profile.email,
      nis: profile.nis ?? '', classId: profile.classId ?? '', active: true,
      ...(snapshot.exists ? updated(actorId) : stamp(actorId))
    }, { merge: true });
  }
}

async function createUser() {
  requireArgs(args, 4, 'npm run users:create -- <email> <password> <nama> <admin|teacher|student> [classId] [nis]');
  const [email, password, name, role, classId, nis] = args;
  if (!ROLES.has(role)) throw new Error(`Peran tidak valid: ${role}`);
  const { auth, db } = initAdmin();
  const created = await auth.createUser({ email: email.trim(), password, displayName: name });
  await ensureRoleDoc(db, created.uid, role, { email: email.trim(), name, classId, nis }, 'admin-script');
  console.log(`Akun dibuat: ${created.uid} ${email} (${role})`);
  console.log('Bagikan kata sandi melalui kanal aman, lalu minta pengguna menggantinya.');
}

async function listUsers() {
  const { auth, db } = initAdmin();
  const users = await db.collection('users').get();
  const result = [];
  for (const doc of users.docs) {
    const data = doc.data();
    let email = data.email || '';
    try {
      if (!email) email = (await auth.getUser(doc.id)).email || '';
    } catch { /* akun Auth mungkin sudah dihapus */ }
    result.push({ uid: doc.id, email, name: data.name, role: data.role, active: data.active });
  }
  console.table(result.sort((a, b) => a.email.localeCompare(b.email)));
}

async function changeRole() {
  requireArgs(args, 2, 'npm run users:role -- <uid|email> <admin|teacher|student>');
  const [identifier, role] = args;
  if (!ROLES.has(role)) throw new Error(`Peran tidak valid: ${role}`);
  const { auth, db } = initAdmin();
  const uid = await findUid(auth, identifier);
  const authUser = await auth.getUser(uid);
  await ensureRoleDoc(db, uid, role, { email: authUser.email ?? '', name: authUser.displayName ?? authUser.email ?? uid }, 'admin-script');
  console.log(`Peran ${uid} diperbarui menjadi ${role}.`);
}

async function changePassword() {
  requireArgs(args, 2, 'npm run users:password -- <uid|email> <kata-sandi-baru>');
  const [identifier, password] = args;
  if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter.');
  const { auth } = initAdmin();
  const uid = await findUid(auth, identifier);
  await auth.updateUser(uid, { password });
  console.log(`Kata sandi ${uid} diperbarui.`);
}

async function deleteUser() {
  requireArgs(args, 1, 'npm run users:delete -- <uid|email>');
  const { auth, db } = initAdmin();
  const uid = await findUid(auth, args[0]);
  const batch = db.batch();
  for (const collection of ['users', 'teachers', 'students']) batch.delete(db.collection(collection).doc(uid));
  await batch.commit();
  await auth.deleteUser(uid);
  console.log(`Akun ${uid} dan profil terkait dihapus.`);
}

const handlers = {
  create: createUser,
  list: listUsers,
  role: changeRole,
  password: changePassword,
  delete: deleteUser
};

try {
  if (!handlers[command]) {
    console.error('Perintah tersedia: create, list, role, password, delete');
    process.exit(1);
  }
  await handlers[command]();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
