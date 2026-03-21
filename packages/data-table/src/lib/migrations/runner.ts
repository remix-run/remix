import { createDatabase, Database } from '../database.ts'
import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import type { SqlStatement } from '../sql.ts'
import type {
  MigrateOptions,
  MigrateResult,
  MigrationContext,
  MigrationDescriptor,
  MigrationDirection,
  MigrationJournalRow,
  MigrationRegistry,
  MigrationRunner,
  MigrationRunnerOptions,
  MigrationStatus,
  MigrationStatusEntry,
} from '../migrations.ts'

import {
  deleteJournalRow,
  ensureMigrationJournal,
  getBatch,
  hasMigrationJournal,
  insertJournalRow,
  loadJournalRows,
  normalizeChecksum,
} from './journal-store.ts'
import { createDryRunDatabase } from './dry-run-database.ts'
import {
  assertMigrateOptions,
  assertNoMigrationDrift,
  assertStepOption,
  assertTargetOption,
  createMigrationStatusEntries,
  listMigrations,
  selectMigrationsToRun,
} from './planning.ts'
import { createMigrationSchema } from './schema-api.ts'

type RunMigrationsInput = {
  adapter: DatabaseAdapter
  migrations: MigrationDescriptor[]
  journalTable: string
  direction: MigrationDirection
  options: MigrateOptions
}

type JournalInsertRow = {
  id: string
  name: string
  checksum: string
  batch: number
}

async function runMigrations(input: RunMigrationsInput): Promise<MigrateResult> {
  let adapter = input.adapter
  let migrations = input.migrations
  let journalTable = input.journalTable
  let dryRun = Boolean(input.options.dryRun)
  let target = input.options.to
  let step = input.options.step

  assertMigrateOptions(input.options)
  assertStepOption(step)
  assertTargetOption(migrations, target)

  let sql: SqlStatement[] = []

  await adapter.acquireMigrationLock?.()

  try {
    let journal: MigrationJournalRow[] = []

    if (dryRun) {
      let canReadJournal = await hasMigrationJournal(adapter, journalTable)

      if (canReadJournal) {
        journal = await loadJournalRows(adapter, journalTable)
      }
    } else {
      await ensureMigrationJournal(adapter, journalTable)
      journal = await loadJournalRows(adapter, journalTable)
    }

    assertNoMigrationDrift(migrations, journal)
    let toRun = selectMigrationsToRun(input.direction, migrations, journal, input.options)

    let applied: MigrationStatusEntry[] = []
    let reverted: MigrationStatusEntry[] = []
    let batch = getBatch(journal)

    for (let migration of toRun) {
      if (
        migration.migration.transaction === 'required' &&
        !adapter.capabilities.transactionalDdl
      ) {
        throw new Error(
          'Migration "' +
            migration.id +
            '" requires transactional DDL, but adapter does not support it',
        )
      }

      let shouldUseTransaction =
        !dryRun &&
        migration.migration.transaction !== 'none' &&
        adapter.capabilities.transactionalDdl
      let token: TransactionToken | undefined

      if (shouldUseTransaction) {
        token = await adapter.beginTransaction()
      }

      let db = dryRun
        ? createDryRunDatabase(adapter)
        : token
          ? new Database(adapter, {
              token,
              savepointCounter: { value: 0 },
            })
          : createDatabase(adapter)

      let schema = createMigrationSchema(
        db,
        async (operation) => {
          let compiled = adapter.compileSql(operation)
          sql.push(...compiled)

          if (!dryRun) {
            await adapter.migrate({ operation, transaction: token })
          }
        },
        { transaction: token },
      )
      let context: MigrationContext = {
        db,
        schema,
      }

      try {
        if (input.direction === 'up') {
          await migration.migration.up(context)

          if (!dryRun) {
            await insertJournalRow(adapter, journalTable, buildJournalRow(migration, batch), token)
          }

          applied.push({
            id: migration.id,
            name: migration.name,
            status: 'applied',
          })
        } else {
          await migration.migration.down(context)

          if (!dryRun) {
            await deleteJournalRow(adapter, journalTable, migration.id, token)
          }

          reverted.push({
            id: migration.id,
            name: migration.name,
            status: 'pending',
          })
        }

        if (token) {
          await adapter.commitTransaction(token)
        }
      } catch (error) {
        if (token) {
          await adapter.rollbackTransaction(token)
        }

        throw error
      }
    }

    return {
      applied,
      reverted,
      sql,
    }
  } finally {
    await adapter.releaseMigrationLock?.()
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
export function createMigrationRunner(
  adapter: DatabaseAdapter,
  migrations: MigrationDescriptor[] | MigrationRegistry,
  options: MigrationRunnerOptions = {},
): MigrationRunner {
  let journalTable = options.journalTable ?? 'data_table_migrations'

  return {
    async up(runOptions: MigrateOptions = {}): Promise<MigrateResult> {
      return runMigrations({
        adapter,
        migrations: listMigrations(migrations),
        journalTable,
        direction: 'up',
        options: runOptions,
      })
    },
    async down(runOptions: MigrateOptions = {}): Promise<MigrateResult> {
      return runMigrations({
        adapter,
        migrations: listMigrations(migrations),
        journalTable,
        direction: 'down',
        options: runOptions,
      })
    },
    async status(): Promise<MigrationStatusEntry[]> {
      await ensureMigrationJournal(adapter, journalTable)

      let journal = await loadJournalRows(adapter, journalTable)
      let sortedMigrations = listMigrations(migrations)
      return createMigrationStatusEntries(sortedMigrations, journal)
    },
  }
}

function buildJournalRow(migration: MigrationDescriptor, batch: number): JournalInsertRow {
  return {
    id: migration.id,
    name: migration.name,
    checksum: normalizeChecksum(migration),
    batch,
  }
}
