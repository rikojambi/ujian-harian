import { openDB, type IDBPDatabase } from 'idb';
import { nanoid } from '@/utils/id';
import type { DataAdapter, QueryFilter, QueryOptions, WriteOperation } from './types';

const INDEX_FIELDS = ['teacherId', 'studentId', 'examId', 'classId', 'subjectId', 'status', 'createdAt'] as const;
type IndexField = (typeof INDEX_FIELDS)[number];

const COLLECTION_NAMES = [
  'users', 'teachers', 'students', 'classes', 'subjects', 'academic_years', 'enrollments',
  'learning_objectives', 'question_banks', 'questions', 'exams', 'exam_questions',
  'student_questions', 'student_explanations', 'exam_assignments', 'exam_attempts',
  'exam_answers', 'exam_results', 'item_analyses', 'student_analyses', 'publications',
  'audit_logs', 'app_settings', 'media_assets', 'credentials'
] as const;

type CollectionName = (typeof COLLECTION_NAMES)[number];
type EntityStore = {
  key: string;
  value: Record<string, unknown> & { id: string };
  indexes: Record<IndexField, string>;
};
type UjianHarianDB = { meta: { key: string; value: { key: string; value: unknown } } } & Record<CollectionName, EntityStore>;

let dbPromise: Promise<IDBPDatabase<UjianHarianDB>> | undefined;

function database(): Promise<IDBPDatabase<UjianHarianDB>> {
  if (!dbPromise) {
    dbPromise = openDB<UjianHarianDB>('ujian-harian-local', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        for (const name of COLLECTION_NAMES) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: 'id' });
          for (const field of INDEX_FIELDS) store.createIndex(field, field);
        }
      }
    });
  }
  return dbPromise;
}

function storeName(collection: string): CollectionName | null {
  return (COLLECTION_NAMES as readonly string[]).includes(collection) ? collection as CollectionName : null;
}

function matches(item: Record<string, unknown>, filter: QueryFilter): boolean {
  const actual = item[filter.field];
  switch (filter.op) {
    case '==': return actual === filter.value;
    case '!=': return actual !== filter.value;
    case '>': return typeof actual === 'string' && String(actual) > String(filter.value);
    case '>=': return typeof actual === 'string' && String(actual) >= String(filter.value);
    case '<': return typeof actual === 'string' && String(actual) < String(filter.value);
    case '<=': return typeof actual === 'string' && String(actual) <= String(filter.value);
    case 'in': return Array.isArray(filter.value) && filter.value.includes(actual);
    case 'array-contains': return Array.isArray(actual) && actual.includes(filter.value);
    default: return false;
  }
}

export const localAdapter: DataAdapter = {
  kind: 'local',
  nextId: () => nanoid(),
  async list<T>(collection: string, options: QueryOptions = {}): Promise<T[]> {
    const name = storeName(collection);
    if (!name) return [];
    const db = await database();
    let items = (await db.getAll(name)) as unknown as Array<Record<string, unknown>>;
    for (const filter of options.filters ?? []) items = items.filter((item) => matches(item, filter));
    if (options.orderBy) {
      const field = options.orderBy.field;
      const dir = options.orderBy.direction === 'desc' ? -1 : 1;
      items.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * dir);
    }
    if (options.limit) items = items.slice(0, options.limit);
    return items as T[];
  },
  async get<T>(collection: string, id: string): Promise<T | null> {
    const name = storeName(collection);
    if (!name) return null;
    const db = await database();
    const value = await db.get(name, id);
    return (value ?? null) as T | null;
  },
  async create<T extends Record<string, unknown>>(collection: string, data: T, id?: string): Promise<string> {
    const name = storeName(collection);
    if (!name) throw new Error(`Koleksi tidak dikenal: ${collection}`);
    const db = await database();
    const key = id ?? nanoid();
    await db.put(name, { ...data, id: key } as EntityStore['value']);
    return key;
  },
  async update(collection: string, id: string, patch: Record<string, unknown>): Promise<void> {
    const name = storeName(collection);
    if (!name) throw new Error(`Koleksi tidak dikenal: ${collection}`);
    const db = await database();
    const current = await db.get(name, id);
    if (!current) throw new Error(`Data tidak ditemukan: ${collection}/${id}`);
    await db.put(name, { ...current, ...patch, id } as EntityStore['value']);
  },
  async remove(collection: string, id: string): Promise<void> {
    const name = storeName(collection);
    if (!name) throw new Error(`Koleksi tidak dikenal: ${collection}`);
    const db = await database();
    await db.delete(name, id);
  },
  async batch(operations: WriteOperation[]): Promise<void> {
    if (!operations.length) return;
    const names = operations.map((op) => storeName(op.collection));
    if (names.some((name) => !name)) throw new Error('Ada koleksi tidak dikenal dalam operasi batch.');
    const db = await database();
    const tx = db.transaction(names as CollectionName[], 'readwrite');
    for (let index = 0; index < operations.length; index += 1) {
      const op = operations[index];
      const store = tx.objectStore(names[index] as CollectionName);
      if (op.type === 'delete' && op.id) await store.delete(op.id);
      else if (op.type === 'create' && op.data) await store.put({ ...op.data, id: op.id ?? nanoid() } as EntityStore['value']);
      else if (op.type === 'update' && op.id && op.data) {
        const current = await store.get(op.id);
        await store.put({ ...current, ...op.data, id: op.id } as EntityStore['value']);
      }
    }
    await tx.done;
  }
};
