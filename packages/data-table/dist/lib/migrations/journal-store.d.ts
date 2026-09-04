import type { DatabaseDriver, TransactionToken } from '../driver.ts';
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts';
export declare function computeChecksum(migration: MigrationDescriptor): Promise<string>;
export declare function ensureMigrationJournal(driver: DatabaseDriver, tableName: string): Promise<void>;
export declare function hasMigrationJournal(driver: DatabaseDriver, tableName: string): Promise<boolean>;
export declare function loadJournalRows(driver: DatabaseDriver, tableName: string): Promise<MigrationJournalRow[]>;
export declare function insertJournalRow(driver: DatabaseDriver, tableName: string, row: {
    id: string;
    name: string;
    checksum: string;
    batch: number;
}, transaction?: TransactionToken): Promise<void>;
export declare function deleteJournalRow(driver: DatabaseDriver, tableName: string, id: string, transaction?: TransactionToken): Promise<void>;
export declare function getBatch(rows: MigrationJournalRow[]): number;
//# sourceMappingURL=journal-store.d.ts.map