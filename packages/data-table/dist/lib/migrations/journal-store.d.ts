import type { DatabaseAdapter, TransactionToken } from '../adapter.ts';
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts';
export declare function normalizeChecksum(migration: MigrationDescriptor): string;
export declare function ensureMigrationJournal(adapter: DatabaseAdapter, tableName: string): Promise<void>;
export declare function hasMigrationJournal(adapter: DatabaseAdapter, tableName: string): Promise<boolean>;
export declare function loadJournalRows(adapter: DatabaseAdapter, tableName: string): Promise<MigrationJournalRow[]>;
export declare function insertJournalRow(adapter: DatabaseAdapter, tableName: string, row: {
    id: string;
    name: string;
    checksum: string;
    batch: number;
}, transaction?: TransactionToken): Promise<void>;
export declare function deleteJournalRow(adapter: DatabaseAdapter, tableName: string, id: string, transaction?: TransactionToken): Promise<void>;
export declare function getBatch(rows: MigrationJournalRow[]): number;
//# sourceMappingURL=journal-store.d.ts.map