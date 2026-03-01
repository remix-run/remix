import { rawSql } from '@remix-run/data-table'
import { createMigrationRunner } from '@remix-run/data-table/migrations'
import { createDataTableJobBackendMigration } from '../backend.ts'

import type { Database } from '@remix-run/data-table'

export let DEFAULT_TEST_TABLE_PREFIX = 'job_test_'

export async function setupJobBackendSchema(
  db: Database,
  tablePrefix = DEFAULT_TEST_TABLE_PREFIX,
): Promise<void> {
  let runner = createMigrationRunner(
    db.adapter,
    [
      {
        id: '0001',
        name: 'create_job_backend_tables',
        migration: createDataTableJobBackendMigration({ tablePrefix }),
      },
    ],
    {
      journalTable: `${tablePrefix}migrations`,
    },
  )

  await runner.up()
}

export async function resetJobBackendSchema(
  db: Database,
  tablePrefix = DEFAULT_TEST_TABLE_PREFIX,
): Promise<void> {
  await setupJobBackendSchema(db, tablePrefix)

  let tables = getTables(tablePrefix)

  await db.exec(rawSql(`delete from ${tables.schedules}`))
  await db.exec(rawSql(`delete from ${tables.dedupe}`))
  await db.exec(rawSql(`delete from ${tables.jobs}`))
}

function getTables(prefix: string): {
  jobs: string
  dedupe: string
  schedules: string
} {
  return {
    jobs: `${prefix}jobs`,
    dedupe: `${prefix}dedupe`,
    schedules: `${prefix}schedules`,
  }
}
