import { getJobSchemaSql } from '../backend.ts'

import type { DataTableDialect } from '../backend.ts'

export let DEFAULT_TEST_TABLE_PREFIX = 'job_test_'

export async function resetJobBackendSchema(
  execute: (statement: string) => Promise<void> | void,
  dialect: DataTableDialect,
  tablePrefix = DEFAULT_TEST_TABLE_PREFIX,
): Promise<void> {
  let tables = getTables(tablePrefix)

  await execute(`drop table if exists ${tables.schedules}`)
  await execute(`drop table if exists ${tables.dedupe}`)
  await execute(`drop table if exists ${tables.jobs}`)

  let statements = getJobSchemaSql(dialect, tablePrefix)

  for (let statement of statements) {
    await execute(statement)
  }
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
