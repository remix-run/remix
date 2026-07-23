import type { DatabaseAdapter, TransactionToken } from '../adapter.ts'
import type {
  MigrateOptions,
  MigrateResult,
  MigrationDescriptor,
  MigrationDirection,
  MigrationJournalRow,
  MigrationRegistry,
  MigrationRunner,
  MigrationRunnerOptions,
  MigrationStatus,
  MigrationStatusEntry,
  MigrationTransactionMode,
} from '../migrations.ts'

import { parseTransactionDirective } from './directive.ts'
import {
  deleteJournalRow,
  ensureMigrationJournal,
  getBatch,
  hasMigrationJournal,
  insertJournalRow,
  loadJournalRows,
  computeChecksum,
} from './journal-store.ts'
import { resolveMigrations } from './registry.ts'

type RunMigrationsInput = {
  adapter: DatabaseAdapter
  migrations: MigrationDescriptor[]
  journalTable: string
  direction: MigrationDirection
  options: MigrateOptions
}

function assertStepOption(step: number | undefined): void {
  if (step === undefined) {
    return
  }

  if (!Number.isInteger(step) || step < 1) {
    throw new Error('Invalid migration step option. Expected a positive integer.')
  }
}

function assertMigrateOptions(options: MigrateOptions): void {
  if (options.to !== undefined && options.step !== undefined) {
    throw new Error('Cannot combine "to" and "step" migration options in the same run')
  }
}

function resolveTargetOption(
  migrations: MigrationDescriptor[],
  to: string | undefined,
): string | undefined {
  if (!to) {
    return undefined
  }

  // Accept either a bare migration id or the full `id_name` directory form and
  // normalize to the bare id so range filtering compares ids consistently.
  let matches = migrations.filter(
    (migration) => migration.id === to || migration.id + '_' + migration.name === to,
  )

  if (matches.length === 0) {
    throw new Error('Unknown migration target: ' + to)
  }

  if (matches.length > 1) {
    throw new Error(
      'Ambiguous migration target "' +
        to +
        '". Matches: ' +
        matches.map((migration) => migration.id + '_' + migration.name).join(', '),
    )
  }

  return matches[0].id
}

async function assertMigrationIntegrity(
  migrations: MigrationDescriptor[],
  journal: MigrationJournalRow[],
  direction: MigrationDirection,
): Promise<void> {
  let migrationMap = new Map(migrations.map((migration) => [migration.id, migration]))

  for (let row of journal) {
    let migration = migrationMap.get(row.id)

    if (!migration) {
      // Rolling back must stay possible when journal rows have no matching
      // migration files, so only forward runs hard-error on orphaned entries.
      if (direction === 'down') {
        continue
      }

      throw new Error(
        'Applied migration "' + row.id + '_' + row.name + '" is missing from current migrations',
      )
    }

    let expected = await computeChecksum(migration)

    if (expected !== row.checksum) {
      throw new Error(
        'Migration checksum drift detected for "' +
          row.id +
          '" (journal=' +
          row.checksum +
          ', current=' +
          expected +
          ')',
      )
    }
  }
}

function resolveTransactionMode(migration: MigrationDescriptor): MigrationTransactionMode {
  if (migration.transaction) {
    return migration.transaction
  }

  let directive = parseTransactionDirective(migration.up)

  if (directive) {
    return directive
  }

  return 'auto'
}

async function runMigrations(input: RunMigrationsInput): Promise<MigrateResult> {
  if (input.adapter.withMigrationLock) {
    return input.adapter.withMigrationLock(input.journalTable, (adapter) =>
      runMigrationsUnlocked({ ...input, adapter }),
    )
  }

  return runMigrationsUnlocked(input)
}

async function runMigrationsUnlocked(input: RunMigrationsInput): Promise<MigrateResult> {
  let adapter = input.adapter
  let migrations = input.migrations
  let journalTable = input.journalTable
  let dryRun = Boolean(input.options.dryRun)
  let step = input.options.step

  assertMigrateOptions(input.options)
  assertStepOption(step)

  let target = resolveTargetOption(migrations, input.options.to)

  let sql: string[] = []

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

  let appliedMap = new Map(journal.map((row) => [row.id, row]))
  await assertMigrationIntegrity(migrations, journal, input.direction)
  let toRun: MigrationDescriptor[] = []

  if (input.direction === 'up') {
    for (let migration of migrations) {
      if (!appliedMap.has(migration.id)) {
        toRun.push(migration)
      }
    }

    if (target) {
      toRun = toRun.filter((migration) => migration.id <= target)
    }

    if (step !== undefined) {
      toRun = toRun.slice(0, step)
    }
  } else {
    toRun = migrations.filter((migration) => appliedMap.has(migration.id)).reverse()

    if (target) {
      toRun = toRun.filter((migration) => migration.id >= target)
    }

    if (step !== undefined) {
      toRun = toRun.slice(0, step)
    }

    for (let migration of toRun) {
      if (migration.down === undefined) {
        throw new Error('Migration "' + migration.id + '" has no down script')
      }
    }
  }

  let applied: MigrationStatusEntry[] = []
  let reverted: MigrationStatusEntry[] = []
  let batch = getBatch(journal)

  for (let migration of toRun) {
    let script = (input.direction === 'up' ? migration.up : migration.down) as string
    let mode = resolveTransactionMode(migration)

    if (mode === 'required' && !adapter.capabilities.transactionalDdl) {
      throw new Error(
        'Migration "' +
          migration.id +
          '" requires transactional DDL, but adapter does not support it',
      )
    }

    let shouldUseTransaction = !dryRun && mode !== 'none' && adapter.capabilities.transactionalDdl
    let token: TransactionToken | undefined

    if (shouldUseTransaction) {
      token = await adapter.beginTransaction()
    }

    sql.push(script)

    try {
      if (!dryRun) {
        if (script.trim().length > 0) {
          await adapter.executeScript(script, token)
        }
      }

      if (input.direction === 'up') {
        if (!dryRun) {
          await insertJournalRow(
            adapter,
            journalTable,
            {
              id: migration.id,
              name: migration.name,
              checksum: await computeChecksum(migration),
              batch,
            },
            token,
          )
        }

        applied.push({
          id: migration.id,
          name: migration.name,
          status: 'applied',
        })
      } else {
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
}

/**
 * Creates a migration runner for applying/reverting SQL migrations against an adapter.
 *
 * The `to` option on `up()`/`down()` accepts a bare migration id or the full
 * `id_name` directory form.
 *
 * Runs verify journal integrity first. `up()` rejects when an applied journal
 * entry is missing from the current migration set, while `down()` skips
 * orphaned journal entries so migrations that are still present can be
 * reverted. Checksum drift on matching entries rejects in both directions.
 * @param adapter Database adapter used to execute migration scripts.
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
        migrations: resolveMigrations(migrations),
        journalTable,
        direction: 'up',
        options: runOptions,
      })
    },
    async down(runOptions: MigrateOptions = {}): Promise<MigrateResult> {
      return runMigrations({
        adapter,
        migrations: resolveMigrations(migrations),
        journalTable,
        direction: 'down',
        options: runOptions,
      })
    },
    async status(): Promise<MigrationStatusEntry[]> {
      await ensureMigrationJournal(adapter, journalTable)

      let journal = await loadJournalRows(adapter, journalTable)
      let journalMap = new Map(journal.map((row) => [row.id, row]))
      let sortedMigrations = resolveMigrations(migrations)
      let migrationIds = new Set(sortedMigrations.map((migration) => migration.id))

      let statuses: MigrationStatusEntry[] = []

      for (let migration of sortedMigrations) {
        let journalRow = journalMap.get(migration.id)

        if (!journalRow) {
          statuses.push({
            id: migration.id,
            name: migration.name,
            status: 'pending' as MigrationStatus,
          })
          continue
        }

        let checksum = await computeChecksum(migration)

        statuses.push({
          id: migration.id,
          name: migration.name,
          status:
            checksum === journalRow.checksum
              ? ('applied' as MigrationStatus)
              : ('drifted' as MigrationStatus),
          appliedAt: journalRow.appliedAt,
          batch: journalRow.batch,
          checksum: journalRow.checksum,
        })
      }

      for (let journalRow of journal) {
        if (migrationIds.has(journalRow.id)) {
          continue
        }

        statuses.push({
          id: journalRow.id,
          name: journalRow.name,
          status: 'missing',
          appliedAt: journalRow.appliedAt,
          batch: journalRow.batch,
          checksum: journalRow.checksum,
        })
      }

      return statuses.sort((left, right) => left.id.localeCompare(right.id))
    },
  }
}
