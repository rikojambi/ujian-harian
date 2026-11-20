import { readFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin.mjs';

const argv = process.argv.slice(2);
const file = argv[0];
function hasFlag(name) { return argv.includes(`--${name}`); }
function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = argv.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? '') : fallback;
}

if (!file) {
  console.error('Penggunaan: npm run restore:firestore -- <file-backup.json> [--overwrite] [--collections=users,exams]');
  process.exit(1);
}

const overwrite = hasFlag('--overwrite');
const only = option('collections', '').split(',').map((item) => item.trim()).filter(Boolean);
const merge = !overwrite;

function decode(value) {
  if (value && typeof value === 'object' && typeof value.__timestamp__ === 'string') {
    return Timestamp.fromDate(new Date(value.__timestamp__));
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

async function main() {
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  if (payload.format !== 'ujian-harian-firestore-backup') {
    throw new Error('Format backup tidak dikenali.');
  }
  const { db } = initAdmin();
  let total = 0;
  let batch = db.batch();
  let pending = 0;

  for (const [name, docs] of Object.entries(payload.collections ?? {})) {
    if (only.length && !only.includes(name)) continue;
    if (!Array.isArray(docs)) continue;
    for (const entry of docs) {
      const ref = db.collection(name).doc(entry.id);
      if (merge) batch.set(ref, decode(entry.data), { merge: true });
      else batch.set(ref, decode(entry.data));
      pending += 1;
      total += 1;
      if (pending >= 450) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    console.log(`${name}: ${docs.length} dokumen dipulihkan`);
  }
  if (pending) await batch.commit();
  console.log(`Restore selesai: ${total} dokumen (${merge ? 'merge' : 'overwrite'}).`);
  console.log('Catatan: dokumen yang tidak ada di backup tidak dihapus. Periksa data sebelum produksi.');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
