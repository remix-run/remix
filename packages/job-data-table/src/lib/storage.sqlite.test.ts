import * as assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import BetterSqlite3, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

import { runJobStorageContract } from '../../../job/src/lib/test/storage-contract.ts'

import { createDataTableJobStorage } from './storage.ts'
import {
  DEFAULT_TEST_TABLE_PREFIX,
  resetJobStorageSchema,
  setupJobStorageSchema,
} from './test/schema.ts'

let integrationEnabled = canOpenSqliteDatabase()

describe('data-table job storage (sqlite)', () => {
  let sqlite: BetterSqliteDatabase
  let database: ReturnType<typeof createDatabase>

  before(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite = new BetterSqlite3(':memory:')
    database = createDatabase(createSqliteDatabaseAdapter(sqlite))
    await setupJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
  })

  after(async () => {
    if (!integrationEnabled) {
      return
    }

    sqlite.close()
  })

  runJobStorageContract('sqlite contract', {
    integrationEnabled,
    setup: async () => {
      await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)
    },
    createStorage: async () =>
      createDataTableJobStorage({
        db: database,
        tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
      }),
  })

  it('rolls back enqueue when using a provided transaction', { skip: !integrationEnabled }, async () => {
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)

    let storage = createDataTableJobStorage({
      db: database,
      tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
    })
    let enqueuedJobId = ''

    await assert.rejects(
      () =>
        database.transaction(async (transaction) => {
          let enqueued = await storage.enqueue(
            {
              name: 'email',
              queue: 'default',
              payload: { to: 'rollback@example.com' },
              runAt: Date.now(),
              priority: 0,
              retry: {
                maxAttempts: 5,
                strategy: 'exponential',
                baseDelayMs: 1000,
                maxDelayMs: 300000,
                jitter: 'full',
              },
              createdAt: Date.now(),
            },
            { transaction },
          )
          enqueuedJobId = enqueued.jobId
          throw new Error('rollback enqueue')
        }),
      /rollback enqueue/,
    )

    assert.notEqual(enqueuedJobId, '')
    assert.equal(await storage.get(enqueuedJobId), null)
  })

  it('rolls back cancel when using a provided transaction', { skip: !integrationEnabled }, async () => {
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)

    let storage = createDataTableJobStorage({
      db: database,
      tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
    })
    let enqueued = await storage.enqueue({
      name: 'email',
      queue: 'default',
      payload: { to: 'cancel@example.com' },
      runAt: Date.now(),
      priority: 0,
      retry: {
        maxAttempts: 5,
        strategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 300000,
        jitter: 'full',
      },
      createdAt: Date.now(),
    })

    await assert.rejects(
      () =>
        database.transaction(async (transaction) => {
          let canceled = await storage.cancel(enqueued.jobId, { transaction })
          assert.equal(canceled, true)
          throw new Error('rollback cancel')
        }),
      /rollback cancel/,
    )

    let job = await storage.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'queued')
  })

  it('commits enqueue when using a provided transaction', { skip: !integrationEnabled }, async () => {
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)

    let storage = createDataTableJobStorage({
      db: database,
      tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
    })
    let enqueuedJobId = ''

    await database.transaction(async (transaction) => {
      let enqueued = await storage.enqueue(
        {
          name: 'email',
          queue: 'default',
          payload: { to: 'commit@example.com' },
          runAt: Date.now(),
          priority: 0,
          retry: {
            maxAttempts: 5,
            strategy: 'exponential',
            baseDelayMs: 1000,
            maxDelayMs: 300000,
            jitter: 'full',
          },
          createdAt: Date.now(),
        },
        { transaction },
      )

      enqueuedJobId = enqueued.jobId
    })

    assert.notEqual(enqueuedJobId, '')
    let job = await storage.get(enqueuedJobId)
    assert.ok(job)
    assert.equal(job.status, 'queued')
  })

  it('commits cancel when using a provided transaction', { skip: !integrationEnabled }, async () => {
    await resetJobStorageSchema(database, DEFAULT_TEST_TABLE_PREFIX)

    let storage = createDataTableJobStorage({
      db: database,
      tablePrefix: DEFAULT_TEST_TABLE_PREFIX,
    })
    let enqueued = await storage.enqueue({
      name: 'email',
      queue: 'default',
      payload: { to: 'commit-cancel@example.com' },
      runAt: Date.now(),
      priority: 0,
      retry: {
        maxAttempts: 5,
        strategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 300000,
        jitter: 'full',
      },
      createdAt: Date.now(),
    })

    await database.transaction(async (transaction) => {
      let canceled = await storage.cancel(enqueued.jobId, { transaction })
      assert.equal(canceled, true)
    })

    let job = await storage.get(enqueued.jobId)
    assert.ok(job)
    assert.equal(job.status, 'canceled')
  })
})

function canOpenSqliteDatabase(): boolean {
  try {
    let database = new BetterSqlite3(':memory:')
    database.close()
    return true
  } catch {
    return false
  }
}
