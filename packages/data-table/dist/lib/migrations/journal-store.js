import { createHash } from 'node:crypto';
import { quoteTableRef } from "../sql-helpers.js";
import { rawSql } from "../sql.js";
import { toTableRef } from "./helpers.js";
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
export function normalizeChecksum(migration) {
    if (migration.checksum) {
        return migration.checksum;
    }
    let content = migration.migration.up.toString() + '\n' + migration.migration.down.toString();
    return createHash('sha256').update(content).digest('hex');
}
/**
 * Quotes an individual SQL identifier using the adapter's native syntax.
 * @param adapter Database adapter that will execute the SQL.
 * @param value Identifier text to quote.
 * @returns Quoted SQL identifier.
 */
function quoteIdentifier(adapter, value) {
    if (adapter.dialect === 'mysql') {
        return '`' + value.replace(/`/g, '``') + '`';
    }
    return '"' + value.replace(/"/g, '""') + '"';
}
/**
 * Returns a fully-quoted SQL table reference for use in raw journal SQL.
 * Handles optional schema-qualified names (e.g. "myschema.migrations").
 * @param adapter Database adapter that will execute the SQL.
 * @param tableName Journal table name, optionally schema-qualified.
 * @returns Fully quoted table reference.
 */
function quoteJournalTable(adapter, tableName) {
    return quoteTableRef(toTableRef(tableName), (value) => quoteIdentifier(adapter, value));
}
export async function ensureMigrationJournal(adapter, tableName) {
    await adapter.migrate({
        operation: {
            kind: 'createTable',
            table: toTableRef(tableName),
            ifNotExists: true,
            columns: {
                id: { type: 'varchar', length: 64, nullable: false, primaryKey: true },
                name: { type: 'varchar', length: 255, nullable: false },
                checksum: { type: 'varchar', length: 128, nullable: false },
                batch: { type: 'integer', nullable: false },
                applied_at: { type: 'timestamp', nullable: false, default: { kind: 'now' } },
            },
        },
    });
}
export async function hasMigrationJournal(adapter, tableName) {
    return adapter.hasTable(toTableRef(tableName));
}
export async function loadJournalRows(adapter, tableName) {
    let quotedTable = quoteJournalTable(adapter, tableName);
    let result = await adapter.execute({
        operation: {
            kind: 'raw',
            sql: rawSql('select id, name, checksum, batch, applied_at from ' + quotedTable + ' order by id asc'),
        },
    });
    let rows = result.rows ?? [];
    return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        checksum: String(row.checksum),
        batch: Number(row.batch),
        appliedAt: new Date(String(row.applied_at)),
    }));
}
export async function insertJournalRow(adapter, tableName, row, transaction) {
    let quotedTable = quoteJournalTable(adapter, tableName);
    await adapter.execute({
        operation: {
            kind: 'raw',
            sql: rawSql('insert into ' + quotedTable + ' (id, name, checksum, batch) values (?, ?, ?, ?)', [row.id, row.name, row.checksum, row.batch]),
        },
        transaction,
    });
}
export async function deleteJournalRow(adapter, tableName, id, transaction) {
    let quotedTable = quoteJournalTable(adapter, tableName);
    await adapter.execute({
        operation: {
            kind: 'raw',
            sql: rawSql('delete from ' + quotedTable + ' where id = ?', [id]),
        },
        transaction,
    });
}
export function getBatch(rows) {
    if (rows.length === 0) {
        return 1;
    }
    let max = Math.max(...rows.map((row) => row.batch));
    return max + 1;
}
