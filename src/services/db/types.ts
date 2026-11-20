export type FilterOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'array-contains';

export interface QueryFilter {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  limit?: number;
}

export interface WriteOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  id?: string;
  data?: Record<string, unknown>;
}

export interface DataAdapter {
  readonly kind: 'firestore' | 'local';
  list<T>(collection: string, options?: QueryOptions): Promise<T[]>;
  get<T>(collection: string, id: string): Promise<T | null>;
  create<T extends Record<string, unknown>>(collection: string, data: T, id?: string): Promise<string>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  batch(operations: WriteOperation[]): Promise<void>;
  nextId(collection: string): string;
}
