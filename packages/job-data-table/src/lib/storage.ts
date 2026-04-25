import { column, rawSql, table } from '@remix-run/data-table'
import { createMigration } from '@remix-run/data-table/migrations'

import type { Database } from '@remix-run/data-table'
import type { Migration } from '@remix-run/data-table/migrations'
import type {
  ClaimDueJobsInput,
  EnqueueJobInput,
  JobStorage,
  JobWriteOptions,
  JobFailureInput,
  ListFailedJobsInput,
  RetryFailedJobInput,
  PruneJobsInput,
  PruneJobsResult,
} from '@remix-run/job/storage'
import type { JobRecord, ResolvedRetryPolicy } from '@remix-run/job'

let DEFAULT_TABLE_PREFIX = 'job_'

type StorageTables = {
  jobs: string
  dedupe: string
}

export interface DataTableJobStorageOptions {
  /**
   * Prefix applied to the jobs and dedupe tables. Defaults to `"job_"`.
   */
  tablePrefix?: string
}

export interface DataTableJobStorageMigrationOptions {
  /**
   * Prefix applied to the jobs and dedupe tables. Defaults to `"job_"`.
   */
  tablePrefix?: string
}

/**
 * Creates a `JobStorage` implementation using `@remix-run/data-table`.
 *
 * @param db Data-table database handle used to persist job state
 * @param options Optional storage configuration
 * @returns A data-table-backed `JobStorage`
 */
export function createDataTableJobStorage(
  db: Database,
  options: DataTableJobStorageOptions = {},
): JobStorage<Database> {
  let baseDb = db
  let storageSchema = createJobStorageSchema(options.tablePrefix)
  let tables = storageSchema.tables
  let runOperation = createOperationRunner(baseDb.adapter.dialect)

  return {
    enqueue(
      input: EnqueueJobInput,
      writeOptions?: JobWriteOptions<Database>,
    ): Promise<{ jobId: string; deduped: boolean }> {
      let db = writeOptions?.transaction ?? baseDb

      return runOperation(() =>
        db.transaction(async (database) => {
          await cleanupExpiredDedupe(database, tables, input.createdAt)

          if (input.dedupeKey != null) {
            let dedupeRows = await database.exec(
              rawSql(
                `select job_id from ${tables.dedupe} where dedupe_key = ? and expires_at > ? limit 1`,
                [input.dedupeKey, input.createdAt],
              ),
            )
            let dedupeRow = dedupeRows.rows?.[0]

            if (dedupeRow != null && typeof dedupeRow.job_id === 'string') {
              return {
                jobId: dedupeRow.job_id,
                deduped: true,
              }
            }
          }

          let jobId = crypto.randomUUID()

          await database.exec(
            rawSql(
              [
                `insert into ${tables.jobs} (`,
                'id, name, queue, payload_json, status, attempts, max_attempts, ',
                'run_at, priority, retry_json, created_at, updated_at',
                ') values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              ].join(''),
              [
                jobId,
                input.name,
                input.queue,
                JSON.stringify(input.payload),
                'queued',
                0,
                input.retry.maxAttempts,
                input.runAt,
                input.priority,
                JSON.stringify(input.retry),
                input.createdAt,
                input.createdAt,
              ],
            ),
          )

          if (input.dedupeKey != null && input.dedupeTtlMs != null && input.dedupeTtlMs > 0) {
            await database.exec(
              rawSql(
                `insert into ${tables.dedupe} (dedupe_key, job_id, expires_at) values (?, ?, ?)`,
                [input.dedupeKey, jobId, input.createdAt + input.dedupeTtlMs],
              ),
            )
          }

          return {
            jobId,
            deduped: false,
          }
        }),
      )
    },
    get(jobId: string): Promise<JobRecord | null> {
      return runOperation(async () => {
        let rows = await baseDb.exec(
          rawSql(`select * from ${tables.jobs} where id = ? limit 1`, [jobId]),
        )
        let row = rows.rows?.[0]

        if (row == null) {
          return null
        }

        return toJobRecord(row)
      })
    },
    cancel(jobId: string, writeOptions?: JobWriteOptions<Database>): Promise<boolean> {
      let db = writeOptions?.transaction ?? baseDb

      return runOperation(() =>
        db.transaction(async (database) => {
          let now = Date.now()
          let result = await database.exec(
            rawSql(
              [
                `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, `,
                'canceled_at = ?, completed_at = null, failed_at = null, updated_at = ? ',
                'where id = ? and status = ?',
              ].join(''),
              ['canceled', now, now, jobId, 'queued'],
            ),
          )

          return (result.affectedRows ?? 0) > 0
        }),
      )
    },
    listFailedJobs(input: ListFailedJobsInput): Promise<JobRecord[]> {
      if (input.limit != null && input.limit <= 0) {
        return Promise.resolve([])
      }

      return runOperation(async () => {
        let rows = await baseDb.exec(
          rawSql(
            [
              `select * from ${tables.jobs} `,
              'where status = ? ',
              input.queue == null ? '' : 'and queue = ? ',
              'order by failed_at desc, updated_at desc limit ?',
            ].join(''),
            input.queue == null ? ['failed', input.limit ?? 50] : ['failed', input.queue, input.limit ?? 50],
          ),
        )

        return (rows.rows ?? []).map(toJobRecord)
      })
    },
    retryFailedJob(
      input: RetryFailedJobInput,
      writeOptions?: JobWriteOptions<Database>,
    ): Promise<{ jobId: string } | null> {
      let db = writeOptions?.transaction ?? baseDb

      return runOperation(() =>
        db.transaction(async (database) => {
          let rows = await database.exec(
            rawSql(
              `select * from ${tables.jobs} where id = ? and status = ? limit 1`,
              [input.jobId, 'failed'],
            ),
          )
          let source = rows.rows?.[0]

          if (source == null) {
            return null
          }

          let sourceJob = toJobRecord(source)
          let now = Date.now()
          let retriedJobId = crypto.randomUUID()

          await database.exec(
            rawSql(
              [
                `insert into ${tables.jobs} (`,
                'id, name, queue, payload_json, status, attempts, max_attempts, ',
                'run_at, priority, retry_json, created_at, updated_at',
                ') values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              ].join(''),
              [
                retriedJobId,
                sourceJob.name,
                input.queue ?? sourceJob.queue,
                JSON.stringify(sourceJob.payload),
                'queued',
                0,
                sourceJob.maxAttempts,
                input.runAt ?? now,
                input.priority ?? sourceJob.priority,
                JSON.stringify(sourceJob.retry),
                now,
                now,
              ],
            ),
          )

          return {
            jobId: retriedJobId,
          }
        }),
      )
    },
    prune(input: PruneJobsInput, writeOptions?: JobWriteOptions<Database>): Promise<PruneJobsResult> {
      let db = writeOptions?.transaction ?? baseDb

      return runOperation(() =>
        db.transaction(async (database) => {
          let whereClauses: string[] = []
          let whereParams: unknown[] = []

          if (input.completedBefore != null) {
            whereClauses.push('(status = ? and completed_at is not null and completed_at <= ?)')
            whereParams.push('completed', input.completedBefore)
          }

          if (input.failedBefore != null) {
            whereClauses.push('(status = ? and failed_at is not null and failed_at <= ?)')
            whereParams.push('failed', input.failedBefore)
          }

          if (input.canceledBefore != null) {
            whereClauses.push('(status = ? and canceled_at is not null and canceled_at <= ?)')
            whereParams.push('canceled', input.canceledBefore)
          }

          if (whereClauses.length === 0 || input.limit <= 0) {
            return {
              deleted: 0,
              completed: 0,
              failed: 0,
              canceled: 0,
            }
          }

          let candidateRows = await database.exec(
            rawSql(
              [
                `select id, status from ${tables.jobs} where `,
                whereClauses.join(' or '),
                ' order by coalesce(completed_at, failed_at, canceled_at) asc limit ?',
              ].join(''),
              [...whereParams, input.limit],
            ),
          )

          let candidateIds: string[] = []
          let completed = 0
          let failed = 0
          let canceled = 0

          for (let row of candidateRows.rows ?? []) {
            if (typeof row.id !== 'string') {
              continue
            }

            candidateIds.push(row.id)

            if (row.status === 'completed') {
              completed += 1
            } else if (row.status === 'failed') {
              failed += 1
            } else if (row.status === 'canceled') {
              canceled += 1
            }
          }

          if (candidateIds.length === 0) {
            return {
              deleted: 0,
              completed: 0,
              failed: 0,
              canceled: 0,
            }
          }

          let inClause = createInClause(candidateIds.length)

          await database.exec(
            rawSql(`delete from ${tables.jobs} where id in ${inClause}`, candidateIds),
          )

          return {
            deleted: candidateIds.length,
            completed,
            failed,
            canceled,
          }
        }),
      )
    },
    claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]> {
      if (input.queues.length === 0 || input.limit <= 0) {
        return Promise.resolve([])
      }

      return runOperation(() =>
        baseDb.transaction(async (database) => {
          await cleanupExpiredDedupe(database, tables, input.now)

          let queueClause = createInClause(input.queues.length)
          let dueRows = await database.exec(
            rawSql(
              [
                `select id from ${tables.jobs} `,
                'where status in (?, ?) and run_at <= ? and queue in ',
                queueClause,
                ' and (locked_until is null or locked_until <= ?) ',
                'order by priority desc, run_at asc, created_at asc limit ?',
              ].join(''),
              ['queued', 'running', input.now, ...input.queues, input.now, input.limit],
            ),
          )

          let claimed: JobRecord[] = []

          for (let row of dueRows.rows ?? []) {
            if (typeof row.id !== 'string') {
              continue
            }

            let lockResult = await database.exec(
              rawSql(
                [
                  `update ${tables.jobs} set status = ?, locked_by = ?, locked_until = ?, `,
                  'attempts = attempts + 1, updated_at = ? ',
                  'where id = ? and run_at <= ? and (',
                  '(status = ?)',
                  ' or ',
                  '(status = ? and locked_until is not null and locked_until <= ?)',
                  ')',
                ].join(''),
                [
                  'running',
                  input.workerId,
                  input.now + input.leaseMs,
                  input.now,
                  row.id,
                  input.now,
                  'queued',
                  'running',
                  input.now,
                ],
              ),
            )

            if ((lockResult.affectedRows ?? 0) === 0) {
              continue
            }

            let claimedRows = await database.exec(
              rawSql(`select * from ${tables.jobs} where id = ? limit 1`, [row.id]),
            )
            let claimedRow = claimedRows.rows?.[0]

            if (claimedRow != null) {
              claimed.push(toJobRecord(claimedRow))
            }
          }

          return claimed
        }),
      )
    },
    heartbeat(input: {
      jobId: string
      workerId: string
      leaseMs: number
      now: number
    }): Promise<boolean> {
      return runOperation(async () => {
        let result = await baseDb.exec(
          rawSql(
            [
              `update ${tables.jobs} set locked_until = ?, updated_at = ? `,
              'where id = ? and status = ? and locked_by = ? and (locked_until is null or locked_until > ?)',
            ].join(''),
            [input.now + input.leaseMs, input.now, input.jobId, 'running', input.workerId, input.now],
          ),
        )

        return (result.affectedRows ?? 0) > 0
      })
    },
    complete(input: { jobId: string; workerId: string; now: number }): Promise<void> {
      return runOperation(async () => {
        await baseDb.exec(
          rawSql(
            [
              `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, `,
              'completed_at = ?, failed_at = null, canceled_at = null, updated_at = ? ',
              'where id = ? and status = ? and locked_by = ?',
            ].join(''),
            ['completed', input.now, input.now, input.jobId, 'running', input.workerId],
          ),
        )
      })
    },
    fail(input: JobFailureInput): Promise<void> {
      return runOperation(async () => {
        if (input.terminal) {
          await baseDb.exec(
            rawSql(
              [
                `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, `,
                'failed_at = ?, completed_at = null, canceled_at = null, last_error = ?, updated_at = ? ',
                'where id = ? and status = ? and locked_by = ?',
              ].join(''),
              ['failed', input.now, input.error, input.now, input.jobId, 'running', input.workerId],
            ),
          )
          return
        }

        await baseDb.exec(
          rawSql(
            [
              `update ${tables.jobs} set status = ?, run_at = ?, locked_by = null, locked_until = null, `,
              'failed_at = null, completed_at = null, canceled_at = null, ',
              'last_error = ?, updated_at = ? where id = ? and status = ? and locked_by = ?',
            ].join(''),
            [
              'queued',
              input.retryAt ?? input.now,
              input.error,
              input.now,
              input.jobId,
              'running',
              input.workerId,
            ],
          ),
        )
      })
    },
  }
}

type JobStorageSchema = {
  tables: StorageTables
  jobsTable: ReturnType<typeof table>
  dedupeTable: ReturnType<typeof table>
}

function createJobStorageSchema(tablePrefix?: string): JobStorageSchema {
  let prefix = normalizeTablePrefix(tablePrefix)
  let tables: StorageTables = {
    jobs: `${prefix}jobs`,
    dedupe: `${prefix}dedupe`,
  }

  let jobsTable = table({
    name: tables.jobs,
    columns: {
      id: column.varchar(191).notNull(),
      name: column.text().notNull(),
      queue: column.varchar(191).notNull(),
      payload_json: column.text().notNull(),
      status: column.varchar(32).notNull(),
      attempts: column.integer().notNull(),
      max_attempts: column.integer().notNull(),
      run_at: column.bigint().notNull(),
      priority: column.integer().notNull(),
      retry_json: column.text().notNull(),
      locked_by: column.text().nullable(),
      locked_until: column.bigint().nullable(),
      last_error: column.text().nullable(),
      created_at: column.bigint().notNull(),
      updated_at: column.bigint().notNull(),
      completed_at: column.bigint().nullable(),
      failed_at: column.bigint().nullable(),
      canceled_at: column.bigint().nullable(),
    },
    primaryKey: 'id',
  })

  let dedupeTable = table({
    name: tables.dedupe,
    columns: {
      dedupe_key: column.varchar(191).notNull(),
      job_id: column.text().notNull(),
      expires_at: column.bigint().notNull(),
    },
    primaryKey: 'dedupe_key',
  })

  return {
    tables,
    jobsTable,
    dedupeTable,
  }
}

/**
 * Creates the built-in migration used to provision `@remix-run/job-data-table` tables.
 *
 * This migration should run before creating a scheduler with `createDataTableJobStorage(...)`.
 *
 * @param options Migration configuration, including the optional table prefix.
 * @returns A data-table migration object that creates/drops storage tables and indexes.
 */
export function createDataTableJobStorageMigration(
  options: DataTableJobStorageMigrationOptions = {},
): Migration {
  let storageSchema = createJobStorageSchema(options.tablePrefix)

  return createMigration({
    async up({ schema }) {
      await schema.createTable(storageSchema.jobsTable, { ifNotExists: true })
      await schema.createTable(storageSchema.dedupeTable, { ifNotExists: true })

      await schema.createIndex(storageSchema.jobsTable, ['status', 'queue', 'run_at', 'priority', 'created_at'], {
        name: `${storageSchema.tables.jobs}_due_idx`,
        ifNotExists: true,
      })
      await schema.createIndex(storageSchema.jobsTable, ['status', 'locked_until'], {
        name: `${storageSchema.tables.jobs}_lock_idx`,
        ifNotExists: true,
      })
      await schema.createIndex(storageSchema.jobsTable, ['status', 'completed_at'], {
        name: `${storageSchema.tables.jobs}_completed_idx`,
        ifNotExists: true,
      })
      await schema.createIndex(storageSchema.jobsTable, ['status', 'failed_at'], {
        name: `${storageSchema.tables.jobs}_failed_idx`,
        ifNotExists: true,
      })
      await schema.createIndex(storageSchema.jobsTable, ['status', 'canceled_at'], {
        name: `${storageSchema.tables.jobs}_canceled_idx`,
        ifNotExists: true,
      })
      await schema.createIndex(storageSchema.dedupeTable, 'expires_at', {
        name: `${storageSchema.tables.dedupe}_expires_idx`,
        ifNotExists: true,
      })
    },
    async down({ schema }) {
      await schema.dropTable(storageSchema.dedupeTable, { ifExists: true })
      await schema.dropTable(storageSchema.jobsTable, { ifExists: true })
    },
  })
}

function createOperationRunner(
  dialect: string,
): <result>(operation: () => Promise<result>) => Promise<result> {
  if (dialect !== 'sqlite') {
    return (operation) => operation()
  }

  let queue = Promise.resolve()

  return (operation) => {
    let queued = queue.then(operation, operation)
    queue = queued.then(
      () => undefined,
      () => undefined,
    )
    return queued
  }
}

async function cleanupExpiredDedupe(db: Database, tables: StorageTables, now: number): Promise<void> {
  await db.exec(rawSql(`delete from ${tables.dedupe} where expires_at <= ?`, [now]))
}

function toJobRecord(row: Record<string, unknown>): JobRecord {
  return {
    id: readString(row.id),
    name: readString(row.name),
    queue: readString(row.queue),
    payload: parseJson(row.payload_json, {}),
    status: readStatus(row.status),
    attempts: parseInteger(row.attempts, 0),
    maxAttempts: parseInteger(row.max_attempts, 1),
    runAt: parseInteger(row.run_at, 0),
    priority: parseInteger(row.priority, 0),
    retry: parseRetry(row.retry_json),
    createdAt: parseInteger(row.created_at, 0),
    updatedAt: parseInteger(row.updated_at, 0),
    lastError: typeof row.last_error === 'string' ? row.last_error : undefined,
    completedAt: parseOptionalInteger(row.completed_at),
    failedAt: parseOptionalInteger(row.failed_at),
    canceledAt: parseOptionalInteger(row.canceled_at),
  }
}

function parseRetry(value: unknown): ResolvedRetryPolicy {
  let parsed = parseJson(value, null)

  if (parsed == null || typeof parsed !== 'object') {
    return {
      maxAttempts: 5,
      strategy: 'exponential',
      baseDelayMs: 1000,
      maxDelayMs: 300000,
      jitter: 'full',
    }
  }

  let retry = parsed as Record<string, unknown>

  return {
    maxAttempts: parseInteger(retry.maxAttempts, 5),
    strategy: retry.strategy === 'fixed' ? 'fixed' : 'exponential',
    baseDelayMs: parseInteger(retry.baseDelayMs, 1000),
    maxDelayMs: parseInteger(retry.maxDelayMs, 300000),
    jitter: retry.jitter === 'none' ? 'none' : 'full',
  }
}

function readStatus(value: unknown): JobRecord['status'] {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'canceled'
  ) {
    return value
  }

  throw new Error(`Invalid job status "${String(value)}"`)
}

function readString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  throw new Error(`Expected string value, got ${String(value)}`)
}

function parseInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value)
  }

  if (typeof value === 'string' && value !== '') {
    let parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return Math.floor(parsed)
    }
  }

  return fallback
}

function parseOptionalInteger(value: unknown): number | undefined {
  if (value == null) {
    return undefined
  }

  return parseInteger(value, 0)
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeTablePrefix(value: string | undefined): string {
  let prefix = value ?? DEFAULT_TABLE_PREFIX

  if (!/^[a-zA-Z0-9_]*$/.test(prefix)) {
    throw new Error('tablePrefix may only contain letters, numbers, and underscores')
  }

  return prefix
}

function createInClause(count: number): string {
  if (count <= 0) {
    throw new Error('IN clause requires at least one value')
  }

  return '(' + new Array(count).fill('?').join(', ') + ')'
}
