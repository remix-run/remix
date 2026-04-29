import { createDatabase, createDatabaseWithTransaction } from "../database.js";
import { deleteJournalRow, ensureMigrationJournal, getBatch, hasMigrationJournal, insertJournalRow, loadJournalRows, normalizeChecksum, } from "./journal-store.js";
import { resolveMigrations } from "./registry.js";
import { createMigrationSchema } from "./schema-api.js";
function assertStepOption(step) {
    if (step === undefined) {
        return;
    }
    if (!Number.isInteger(step) || step < 1) {
        throw new Error('Invalid migration step option. Expected a positive integer.');
    }
}
function assertMigrateOptions(options) {
    if (options.to !== undefined && options.step !== undefined) {
        throw new Error('Cannot combine "to" and "step" migration options in the same run');
    }
}
function assertTargetOption(migrations, to) {
    if (!to) {
        return;
    }
    let target = migrations.find((migration) => migration.id === to);
    if (!target) {
        throw new Error('Unknown migration target: ' + to);
    }
}
function assertNoMigrationDrift(migrations, journal) {
    let migrationMap = new Map(migrations.map((migration) => [migration.id, migration]));
    for (let row of journal) {
        let migration = migrationMap.get(row.id);
        if (!migration) {
            continue;
        }
        let expected = normalizeChecksum(migration);
        if (expected !== row.checksum) {
            throw new Error('Migration checksum drift detected for "' +
                row.id +
                '" (journal=' +
                row.checksum +
                ', current=' +
                expected +
                ')');
        }
    }
}
function createDryRunDatabase(adapter) {
    let error = new Error('Cannot execute data operations while running migrations with dryRun');
    let throwDryRunError = async () => {
        throw error;
    };
    let dryRunAdapter = {
        dialect: adapter.dialect,
        capabilities: adapter.capabilities,
        compileSql(operation) {
            return adapter.compileSql(operation);
        },
        async hasTable(table) {
            return adapter.hasTable(table);
        },
        async hasColumn(table, column) {
            return adapter.hasColumn(table, column);
        },
        execute: throwDryRunError,
        migrate: throwDryRunError,
        beginTransaction: throwDryRunError,
        commitTransaction: throwDryRunError,
        rollbackTransaction: throwDryRunError,
        createSavepoint: throwDryRunError,
        rollbackToSavepoint: throwDryRunError,
        releaseSavepoint: throwDryRunError,
    };
    return createDatabase(dryRunAdapter);
}
async function runMigrations(input) {
    let adapter = input.adapter;
    let migrations = input.migrations;
    let journalTable = input.journalTable;
    let dryRun = Boolean(input.options.dryRun);
    let target = input.options.to;
    let step = input.options.step;
    assertMigrateOptions(input.options);
    assertStepOption(step);
    assertTargetOption(migrations, target);
    let sql = [];
    await adapter.acquireMigrationLock?.();
    try {
        let journal = [];
        if (dryRun) {
            let canReadJournal = await hasMigrationJournal(adapter, journalTable);
            if (canReadJournal) {
                journal = await loadJournalRows(adapter, journalTable);
            }
        }
        else {
            await ensureMigrationJournal(adapter, journalTable);
            journal = await loadJournalRows(adapter, journalTable);
        }
        let appliedMap = new Map(journal.map((row) => [row.id, row]));
        assertNoMigrationDrift(migrations, journal);
        let toRun = [];
        if (input.direction === 'up') {
            for (let migration of migrations) {
                if (!appliedMap.has(migration.id)) {
                    toRun.push(migration);
                }
            }
            if (target) {
                toRun = toRun.filter((migration) => migration.id <= target);
            }
            if (step !== undefined) {
                toRun = toRun.slice(0, step);
            }
        }
        else {
            let appliedMigrations = migrations
                .filter((migration) => appliedMap.has(migration.id))
                .reverse();
            if (target) {
                appliedMigrations = appliedMigrations.filter((migration) => migration.id >= target);
            }
            if (step !== undefined) {
                appliedMigrations = appliedMigrations.slice(0, step);
            }
            toRun = appliedMigrations;
        }
        let applied = [];
        let reverted = [];
        let batch = getBatch(journal);
        for (let migration of toRun) {
            if (migration.migration.transaction === 'required' &&
                !adapter.capabilities.transactionalDdl) {
                throw new Error('Migration "' +
                    migration.id +
                    '" requires transactional DDL, but adapter does not support it');
            }
            let shouldUseTransaction = !dryRun &&
                migration.migration.transaction !== 'none' &&
                adapter.capabilities.transactionalDdl;
            let token;
            if (shouldUseTransaction) {
                token = await adapter.beginTransaction();
            }
            let db = dryRun
                ? createDryRunDatabase(adapter)
                : token
                    ? createDatabaseWithTransaction(adapter, token)
                    : createDatabase(adapter);
            let schema = createMigrationSchema(db, async (operation) => {
                let compiled = adapter.compileSql(operation);
                sql.push(...compiled);
                if (!dryRun) {
                    await adapter.migrate({ operation, transaction: token });
                }
            }, { transaction: token });
            let context = {
                db,
                schema,
            };
            try {
                if (input.direction === 'up') {
                    await migration.migration.up(context);
                    if (!dryRun) {
                        await insertJournalRow(adapter, journalTable, {
                            id: migration.id,
                            name: migration.name,
                            checksum: normalizeChecksum(migration),
                            batch,
                        }, token);
                    }
                    applied.push({
                        id: migration.id,
                        name: migration.name,
                        status: 'applied',
                    });
                }
                else {
                    await migration.migration.down(context);
                    if (!dryRun) {
                        await deleteJournalRow(adapter, journalTable, migration.id, token);
                    }
                    reverted.push({
                        id: migration.id,
                        name: migration.name,
                        status: 'pending',
                    });
                }
                if (token) {
                    await adapter.commitTransaction(token);
                }
            }
            catch (error) {
                if (token) {
                    await adapter.rollbackTransaction(token);
                }
                throw error;
            }
        }
        return {
            applied,
            reverted,
            sql,
        };
    }
    finally {
        await adapter.releaseMigrationLock?.();
    }
}
/**
 * Creates a migration runner for applying/reverting migrations against an adapter.
 * @param adapter Database adapter used to compile and execute migration operations.
 * @param migrations Migration descriptors or registry.
 * @param options Optional runner configuration.
 * @returns A migration runner instance.
 * @example
 * ```ts
 * import { createMigrationRunner } from 'remix/data-table/migrations'
 *
 * let runner = createMigrationRunner(adapter, migrations, {
 *   journalTable: 'app_migrations',
 * })
 * await runner.up()
 * ```
 */
export function createMigrationRunner(adapter, migrations, options = {}) {
    let journalTable = options.journalTable ?? 'data_table_migrations';
    return {
        async up(runOptions = {}) {
            return runMigrations({
                adapter,
                migrations: resolveMigrations(migrations),
                journalTable,
                direction: 'up',
                options: runOptions,
            });
        },
        async down(runOptions = {}) {
            return runMigrations({
                adapter,
                migrations: resolveMigrations(migrations),
                journalTable,
                direction: 'down',
                options: runOptions,
            });
        },
        async status() {
            await ensureMigrationJournal(adapter, journalTable);
            let journal = await loadJournalRows(adapter, journalTable);
            let journalMap = new Map(journal.map((row) => [row.id, row]));
            let sortedMigrations = resolveMigrations(migrations);
            return sortedMigrations.map((migration) => {
                let journalRow = journalMap.get(migration.id);
                if (!journalRow) {
                    return {
                        id: migration.id,
                        name: migration.name,
                        status: 'pending',
                    };
                }
                let checksum = normalizeChecksum(migration);
                return {
                    id: migration.id,
                    name: migration.name,
                    status: checksum === journalRow.checksum
                        ? 'applied'
                        : 'drifted',
                    appliedAt: journalRow.appliedAt,
                    batch: journalRow.batch,
                    checksum: journalRow.checksum,
                };
            });
        },
    };
}
