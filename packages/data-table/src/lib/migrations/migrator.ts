import type { Database } from '../database.ts'
import type { Migration, Migrator } from '../migrations.ts'

import {
  computeMigrationHash,
  ensureMigrationJournal,
  getBatch,
  insertJournalRow,
  loadJournalRows,
  type MigrationJournalRow,
} from './journal-store.ts'

type MigrationStatusEntry = {
  id: string
  status: 'applied' | 'pending' | 'drifted'
  appliedAt?: Date
  batch?: number
  hash?: string
}

export function createMigrator(
  migrations: Migration[],
  options: {
    journalTable?: string
  } = {},
): Migrator {
  let sortedMigrations = normalizeMigrations(migrations)
  let journalTable = options.journalTable ?? 'data_table_migrations'

  return {
    async migrate(database, options) {
      let adapter = database.adapter
      assertTargetOption(sortedMigrations, options?.to)

      await adapter.acquireMigrationLock?.()

      try {
        await ensureMigrationJournal(adapter, journalTable)

        let journal = await loadJournalRows(adapter, journalTable)
        let statuses = await getMigrationStatusFromJournal(sortedMigrations, journal)
        let drifted = statuses.find(({ status }) => status === 'drifted')

        if (drifted !== undefined) {
          throw new Error('Migration hash drift detected for "' + drifted.id + '"')
        }

        let appliedIds = new Set(journal.map((row) => row.id))
        let pending = sortedMigrations.filter((migration) => !appliedIds.has(migration.id))

        if (options?.to !== undefined) {
          pending = pending.filter((migration) => migration.id <= options.to!)
        }

        let batch = getBatch(journal)
        let applied: Migration[] = []

        for (let migration of pending) {
          let token = adapter.capabilities.transactionalDdl
            ? await adapter.beginTransaction()
            : undefined

          try {
            if (migration.sql.trim().length > 0) {
              await adapter.executeScript(migration.sql, token)
            }

            let hash = await computeMigrationHash(migration)
            await insertJournalRow(
              adapter,
              journalTable,
              {
                id: migration.id,
                hash,
                batch,
              },
              token,
            )

            applied.push(migration)

            if (token !== undefined) {
              await adapter.commitTransaction(token)
            }
          } catch (error) {
            if (token !== undefined) {
              await adapter.rollbackTransaction(token)
            }

            throw error
          }
        }

        return { applied }
      } finally {
        await adapter.releaseMigrationLock?.()
      }
    },

    async status(database) {
      await ensureMigrationJournal(database.adapter, journalTable)
      let journal = await loadJournalRows(database.adapter, journalTable)
      return getMigrationStatusFromJournal(sortedMigrations, journal)
    },
  }
}

async function getMigrationStatusFromJournal(
  migrations: Migration[],
  journal: MigrationJournalRow[],
): Promise<MigrationStatusEntry[]> {
  let journalMap = new Map(journal.map((row) => [row.id, row]))
  let statuses: MigrationStatusEntry[] = []

  for (let migration of migrations) {
    let journalRow = journalMap.get(migration.id)

    if (journalRow === undefined) {
      statuses.push({ id: migration.id, status: 'pending' })
      continue
    }

    let hash = await computeMigrationHash(migration)

    statuses.push({
      id: migration.id,
      status: hash === journalRow.hash ? 'applied' : 'drifted',
      appliedAt: journalRow.appliedAt,
      batch: journalRow.batch,
      hash: journalRow.hash,
    })
  }

  return statuses
}

function normalizeMigrations(migrations: Migration[]): Migration[] {
  let sorted = [...migrations].sort((left, right) => left.id.localeCompare(right.id))
  let seenIds = new Set<string>()

  for (let migration of sorted) {
    if (seenIds.has(migration.id)) {
      throw new Error('Duplicate migration id: ' + migration.id)
    }

    seenIds.add(migration.id)
  }

  return sorted
}

function assertTargetOption(migrations: Migration[], to: string | undefined): void {
  if (to === undefined) {
    return
  }

  let target = migrations.find((migration) => migration.id === to)

  if (target === undefined) {
    throw new Error('Unknown migration target: ' + to)
  }
}
