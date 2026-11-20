import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit as limitFn, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type QueryConstraint, type WhereFilterOp
} from 'firebase/firestore';
import { getFirestoreDb } from '@/services/firebase/config';
import { nanoid } from '@/utils/id';
import type { DataAdapter, QueryOptions, WriteOperation } from './types';

function constraints(options: QueryOptions = {}): QueryConstraint[] {
  const result: QueryConstraint[] = [];
  for (const filter of options.filters ?? []) {
    result.push(where(filter.field, filter.op as WhereFilterOp, filter.value));
  }
  if (options.orderBy) result.push(orderBy(options.orderBy.field, options.orderBy.direction ?? 'asc'));
  if (options.limit) result.push(limitFn(options.limit));
  return result;
}

function serialize(data: Record<string, unknown>): DocumentData {
  const out: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value)
      ? value.map((item) => (item && typeof item === 'object' ? serialize(item as Record<string, unknown>) : item))
      : value && typeof value === 'object' && !(value instanceof Date)
        ? serialize(value as Record<string, unknown>)
        : value;
  }
  return out;
}

export const firestoreAdapter: DataAdapter = {
  kind: 'firestore',
  nextId: () => nanoid(),
  async list<T>(collectionName: string, options: QueryOptions = {}): Promise<T[]> {
    const snapshot = await getDocs(query(collection(getFirestoreDb(), collectionName), ...constraints(options)));
    return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as T);
  },
  async get<T>(collectionName: string, id: string): Promise<T | null> {
    const snapshot = await getDoc(doc(getFirestoreDb(), collectionName, id));
    return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as T) : null;
  },
  async create<T extends Record<string, unknown>>(collectionName: string, data: T, id?: string): Promise<string> {
    const payload = serialize(data);
    if (id) {
      await setDoc(doc(getFirestoreDb(), collectionName, id), payload);
      return id;
    }
    const reference = await addDoc(collection(getFirestoreDb(), collectionName), payload);
    return reference.id;
  },
  async update(collectionName: string, id: string, patch: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(getFirestoreDb(), collectionName, id), serialize(patch));
  },
  async remove(collectionName: string, id: string): Promise<void> {
    await deleteDoc(doc(getFirestoreDb(), collectionName, id));
  },
  async batch(operations: WriteOperation[]): Promise<void> {
    const firestore = getFirestoreDb();
    const write = writeBatch(firestore);
    for (const op of operations) {
      const ref = doc(firestore, op.collection, op.id ?? nanoid());
      if (op.type === 'delete') write.delete(ref);
      else if (op.type === 'create') write.set(ref, serialize({ ...op.data, createdAt: new Date().toISOString() }));
      else if (op.type === 'update') write.update(ref, serialize({ ...op.data, updatedAt: new Date().toISOString() }));
    }
    await write.commit();
  }
};

export { serverTimestamp };
