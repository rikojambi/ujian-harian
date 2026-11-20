import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { initAdmin } from './lib/admin.mjs';

const argv = process.argv.slice(2);
function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const inline = argv.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? (argv[index + 1] ?? '') : fallback;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = option('out', `backups/firestore-${stamp}.json`);
const only = option('collections', '').split(',').map((item) => item.trim()).filter(Boolean);
const exclude = option('exclude', '').split(',').map((item) => item.trim()).filter(Boolean);

function encode(value) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return { __timestamp__: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  }
  return value;
}

async function main() {
  const { db, projectId } = initAdmin();
  const collections = await db.listCollections();
  const payload = {
    format: 'ujian-harian-firestore-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    projectId,
    collections: {}
  };

  let documentCount = 0;
  for (const collection of collections) {
    const name = collection.id;
    if (only.length && !only.includes(name)) continue;
    if (exclude.includes(name)) continue;
    const snapshot = await collection.get();
    payload.collections[name] = snapshot.docs.map((doc) => ({ id: doc.id, data: encode(doc.data()) }));
    documentCount += snapshot.size;
    console.log(`${name}: ${snapshot.size} dokumen`);
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Backup selesai: ${output} (${documentCount} dokumen).`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
