import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTableName } from '@remix-run/data-table'

import { createDataTableJobBackendMigration } from './backend.ts'

describe('createDataTableJobBackendMigration', () => {
  it('creates prefixed tables and indexes', async () => {
    let migration = createDataTableJobBackendMigration({ tablePrefix: 'custom_' })
    let calls: string[] = []

    let schema = {
      async createTable(tableInput: Parameters<typeof getTableName>[0]) {
        calls.push(`createTable:${getTableName(tableInput)}`)
      },
      async createIndex(
        tableInput: Parameters<typeof getTableName>[0],
        columns: string | string[],
        options?: { name?: string },
      ) {
        let indexed = Array.isArray(columns) ? columns.join(',') : columns
        calls.push(`createIndex:${getTableName(tableInput)}:${indexed}:${options?.name ?? ''}`)
      },
      async dropTable() {},
    } as never

    await migration.up({ db: {} as never, schema })

    assert.deepEqual(calls, [
      'createTable:custom_jobs',
      'createTable:custom_dedupe',
      'createTable:custom_schedules',
      'createIndex:custom_jobs:status,queue,run_at,priority,created_at:custom_jobs_due_idx',
      'createIndex:custom_jobs:status,locked_until:custom_jobs_lock_idx',
      'createIndex:custom_dedupe:expires_at:custom_dedupe_expires_idx',
      'createIndex:custom_schedules:next_run_at,locked_until:custom_schedules_due_idx',
    ])
  })

  it('drops prefixed tables in reverse dependency order', async () => {
    let migration = createDataTableJobBackendMigration({ tablePrefix: 'custom_' })
    let calls: string[] = []
    let schema = {
      async createTable() {},
      async createIndex() {},
      async dropTable(tableInput: Parameters<typeof getTableName>[0]) {
        calls.push(`dropTable:${getTableName(tableInput)}`)
      },
    } as never

    await migration.down({ db: {} as never, schema })

    assert.deepEqual(calls, [
      'dropTable:custom_schedules',
      'dropTable:custom_dedupe',
      'dropTable:custom_jobs',
    ])
  })

  it('throws for invalid table prefixes', () => {
    assert.throws(() => {
      createDataTableJobBackendMigration({ tablePrefix: 'job-test' })
    }, /tablePrefix may only contain letters, numbers, and underscores/)
  })
})
