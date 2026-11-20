import { isFirebaseConfigured } from '@/services/firebase/config';
import { firestoreAdapter } from './firestore';
import { localAdapter } from './local';
import type { DataAdapter } from './types';

export const db: DataAdapter = isFirebaseConfigured ? firestoreAdapter : localAdapter;
export const isLocalMode = db.kind === 'local';
export type { DataAdapter, QueryFilter, QueryOptions, WriteOperation } from './types';
