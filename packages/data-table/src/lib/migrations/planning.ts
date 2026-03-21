import type {
  MigrateOptions,
  MigrationDescriptor,
  MigrationDirection,
  MigrationJournalRow,
  MigrationRegistry,
  MigrationStatusEntry,
} from '../migrations.ts'

import { normalizeChecksum } from './journal-store.ts'

export function listMigrations(
  migrations: MigrationDescriptor[] | MigrationRegistry,
): MigrationDescriptor[] {
  return Array.isArray(migrations)
    ? [...migrations].sort((left, right) => left.id.localeCompare(right.id))
    : migrations.list()
}

export function assertStepOption(step: number | undefined): void {
  if (step === undefined) {
    return
  }

  if (!Number.isInteger(step) || step < 1) {
    throw new Error('Invalid migration step option. Expected a positive integer.')
  }
}

export function assertMigrateOptions(options: MigrateOptions): void {
  if (options.to !== undefined && options.step !== undefined) {
    throw new Error('Cannot combine "to" and "step" migration options in the same run')
  }
}

export function assertTargetOption(
  migrations: MigrationDescriptor[],
  to: string | undefined,
): void {
  if (!to) {
    return
  }

  if (!migrations.some((migration) => migration.id === to)) {
    throw new Error('Unknown migration target: ' + to)
  }
}

export function assertNoMigrationDrift(
  migrations: MigrationDescriptor[],
  journal: MigrationJournalRow[],
): void {
  let migrationMap = new Map(migrations.map((migration) => [migration.id, migration]))

  for (let row of journal) {
    let migration = migrationMap.get(row.id)

    if (!migration) {
      continue
    }

    let expected = normalizeChecksum(migration)

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

export function selectMigrationsToRun(
  direction: MigrationDirection,
  migrations: MigrationDescriptor[],
  journal: MigrationJournalRow[],
  options: MigrateOptions,
): MigrationDescriptor[] {
  let appliedIds = new Set(journal.map((row) => row.id))
  let target = options.to
  let step = options.step

  if (direction === 'up') {
    let pending = migrations.filter((migration) => !appliedIds.has(migration.id))

    if (target) {
      pending = pending.filter((migration) => migration.id <= target)
    }

    if (step !== undefined) {
      pending = pending.slice(0, step)
    }

    return pending
  }

  let applied = migrations.filter((migration) => appliedIds.has(migration.id)).reverse()

  if (target) {
    applied = applied.filter((migration) => migration.id >= target)
  }

  if (step !== undefined) {
    applied = applied.slice(0, step)
  }

  return applied
}

export function createMigrationStatusEntries(
  migrations: MigrationDescriptor[],
  journal: MigrationJournalRow[],
): MigrationStatusEntry[] {
  let journalMap = new Map(journal.map((row) => [row.id, row]))

  return migrations.map((migration) => {
    let journalRow = journalMap.get(migration.id)

    if (!journalRow) {
      return {
        id: migration.id,
        name: migration.name,
        status: 'pending',
      }
    }

    let checksum = normalizeChecksum(migration)

    return {
      id: migration.id,
      name: migration.name,
      status: checksum === journalRow.checksum ? 'applied' : 'drifted',
      appliedAt: journalRow.appliedAt,
      batch: journalRow.batch,
      checksum: journalRow.checksum,
    }
  })
}
