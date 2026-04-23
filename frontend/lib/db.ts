import Dexie, { Table } from 'dexie';

export interface LocalProduct {
  id: string;
  name: string;
  totalStock: number;
  image?: string;
  categoryName?: string;
  variants: any[]; // Store variants as array
  lastUpdated: number;
}

export interface LocalClient {
  id: string;
  name: string;
  documentId?: string;
  walletBalance?: number;
}

export interface PendingSale {
  id?: number;
  data: any;        // The sale payload
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  errorMessage?: string;
}

export class SyncroDB extends Dexie {
  products!: Table<LocalProduct>;
  clients!: Table<LocalClient>;
  pendingSales!: Table<PendingSale>;
  cache!: Table<{ key: string; value: any; expiresAt?: number }>;

  constructor() {
    super('SyncroPOS');
    this.version(1).stores({
      products: 'id, name, categoryName', // Primary key and indexable props
      clients: 'id, name, documentId',
      pendingSales: '++id, status, createdAt',
      cache: 'key'
    });
  }
}

export const db = new SyncroDB();
