import type { DatabaseAdapter, TransactionToken } from '../adapter.ts';
import type { MigrationDescriptor, MigrationJournalRow } from '../migrations.ts';
/**
 * Returns a stable content-based checksum for a migration.
 *
 * If the descriptor already carries an explicit `checksum` (e.g. supplied by
 * a file-based registry that hashed the source on disk), that value is used
 * as-is.  Otherwise a SHA-256 digest of the `up` and `down` function source
 * text is computed.  This catches accidental edits to already-applied
 * migrations that would previously have gone undetected because the fallback
 * only used the migration `id` and `name`.
 * @param migration Migration descriptor to normalize.
 * @returns Stable checksum string.
 */
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