import type { MigrationLockContext, TransactionToken } from '../adapter.ts';
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts';
export declare function computeChecksum(migration: MigrationDescriptor): Promise<string>;
export declare function ensureMigrationJournal(adapter: MigrationLockContext, tableName: string): Promise<void>;
export declare function hasMigrationJournal(adapter: MigrationLockContext, tableName: string): Promise<boolean>;
export declare function loadJournalRows(adapter: MigrationLockContext, tableName: string): Promise<MigrationJournalRow[]>;
export declare function insertJournalRow(adapter: MigrationLockContext, tableName: string, row: {
    id: string;
    name: string;
    checksum: string;
    batch: number;
}, transaction?: TransactionToken): Promise<void>;
export declare function deleteJournalRow(adapter: MigrationLockContext, tableName: string, id: string, transaction?: TransactionToken): Promise<void>;
export declare function getBatch(rows: MigrationJournalRow[]): number;
//# sourceMappingURL=journal-store.d.ts.map