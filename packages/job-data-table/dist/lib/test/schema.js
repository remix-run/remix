import { rawSql } from '@remix-run/data-table';
import { createMigrationRunner } from '@remix-run/data-table/migrations';
import { createDataTableJobStorageMigration } from "../storage.js";
export let DEFAULT_TEST_TABLE_PREFIX = 'job_test_';
export async function setupJobStorageSchema(db, tablePrefix = DEFAULT_TEST_TABLE_PREFIX) {
    let runner = createMigrationRunner(db.adapter, [
        {
            id: '0001',
            name: 'create_job_storage_tables',
            migration: createDataTableJobStorageMigration({ tablePrefix }),
        },
    ], {
        journalTable: `${tablePrefix}migrations`,
    });
    await runner.up();
}
export async function resetJobStorageSchema(db, tablePrefix = DEFAULT_TEST_TABLE_PREFIX) {
    await setupJobStorageSchema(db, tablePrefix);
    let tables = getTables(tablePrefix);
    await db.exec(rawSql(`delete from ${tables.dedupe}`));
    await db.exec(rawSql(`delete from ${tables.jobs}`));
}
function getTables(prefix) {
    return {
        jobs: `${prefix}jobs`,
        dedupe: `${prefix}dedupe`,
    };
}
