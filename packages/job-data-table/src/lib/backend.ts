import { rawSql } from '@remix-run/data-table'

import type { Database } from '@remix-run/data-table'
import type {
  ClaimDueJobsInput,
  ClaimDueSchedulesInput,
  DueSchedule,
  EnqueueJobInput,
  JobBackend,
  JobFailureInput,
  PersistedCronSchedule,
} from '@remix-run/job/backend'
import type { JobRecord, ResolvedRetryPolicy } from '@remix-run/job'

let DEFAULT_TABLE_PREFIX = 'job_'

export type DataTableDialect = 'postgres' | 'mysql' | 'sqlite'

type BackendTables = {
  jobs: string
  dedupe: string
  schedules: string
}

export interface DataTableJobBackendOptions {
  db: Database
  dialect: DataTableDialect
  tablePrefix?: string
}

/**
 * Creates a `JobBackend` implementation using `@remix-run/data-table`.
 *
 * @param options Backend configuration
 * @returns A data-table-backed `JobBackend`
 */
export function createDataTableJobBackend(options: DataTableJobBackendOptions): JobBackend {
  let prefix = normalizeTablePrefix(options.tablePrefix)
  let tables: BackendTables = {
    jobs: `${prefix}jobs`,
    dedupe: `${prefix}dedupe`,
    schedules: `${prefix}schedules`,
  }
  let runOperation = createOperationRunner(options.dialect)

  return {
    enqueue(input: EnqueueJobInput): Promise<{ jobId: string; deduped: boolean }> {
      return runOperation(() =>
        options.db.transaction(async (database) => {
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
        let rows = await options.db.exec(
          rawSql(`select * from ${tables.jobs} where id = ? limit 1`, [jobId]),
        )
        let row = rows.rows?.[0]

        if (row == null) {
          return null
        }

        return toJobRecord(row)
      })
    },
    cancel(jobId: string): Promise<boolean> {
      return runOperation(async () => {
        let result = await options.db.exec(
          rawSql(
            `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, updated_at = ? where id = ? and status = ?`,
            ['canceled', Date.now(), jobId, 'queued'],
          ),
        )

        return (result.affectedRows ?? 0) > 0
      })
    },
    claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]> {
      if (input.queues.length === 0 || input.limit <= 0) {
        return Promise.resolve([])
      }

      return runOperation(() =>
        options.db.transaction(async (database) => {
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
        let result = await options.db.exec(
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
        await options.db.exec(
          rawSql(
            [
              `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, `,
              'completed_at = ?, updated_at = ? where id = ? and status = ? and locked_by = ?',
            ].join(''),
            ['completed', input.now, input.now, input.jobId, 'running', input.workerId],
          ),
        )
      })
    },
    fail(input: JobFailureInput): Promise<void> {
      return runOperation(async () => {
        if (input.terminal) {
          await options.db.exec(
            rawSql(
              [
                `update ${tables.jobs} set status = ?, locked_by = null, locked_until = null, `,
                'failed_at = ?, last_error = ?, updated_at = ? ',
                'where id = ? and status = ? and locked_by = ?',
              ].join(''),
              ['failed', input.now, input.error, input.now, input.jobId, 'running', input.workerId],
            ),
          )
          return
        }

        await options.db.exec(
          rawSql(
            [
              `update ${tables.jobs} set status = ?, run_at = ?, locked_by = null, locked_until = null, `,
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
    upsertSchedules(input: PersistedCronSchedule[]): Promise<void> {
      return runOperation(() =>
        options.db.transaction(async (database) => {
          for (let schedule of input) {
            let existingRows = await database.exec(
              rawSql(`select next_run_at from ${tables.schedules} where id = ? limit 1`, [schedule.id]),
            )
            let existing = existingRows.rows?.[0]

            if (existing != null) {
              let existingNextRunAt = parseInteger(existing.next_run_at, schedule.nextRunAt)
              let nextRunAt = Math.min(existingNextRunAt, schedule.nextRunAt)

              await database.exec(
                rawSql(
                  [
                    `update ${tables.schedules} set `,
                    'cron = ?, timezone = ?, queue = ?, name = ?, payload_json = ?, retry_json = ?, ',
                    'catch_up = ?, next_run_at = ?, locked_by = null, locked_until = null, updated_at = ? ',
                    'where id = ?',
                  ].join(''),
                  [
                    schedule.cron,
                    schedule.timezone,
                    schedule.queue,
                    schedule.name,
                    JSON.stringify(schedule.payload),
                    JSON.stringify(schedule.retry),
                    schedule.catchUp,
                    nextRunAt,
                    Date.now(),
                    schedule.id,
                  ],
                ),
              )
              continue
            }

            await database.exec(
              rawSql(
                [
                  `insert into ${tables.schedules} (`,
                  'id, cron, timezone, queue, name, payload_json, retry_json, catch_up, ',
                  'next_run_at, updated_at',
                  ') values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ].join(''),
                [
                  schedule.id,
                  schedule.cron,
                  schedule.timezone,
                  schedule.queue,
                  schedule.name,
                  JSON.stringify(schedule.payload),
                  JSON.stringify(schedule.retry),
                  schedule.catchUp,
                  schedule.nextRunAt,
                  Date.now(),
                ],
              ),
            )
          }
        }),
      )
    },
    claimDueSchedules(input: ClaimDueSchedulesInput): Promise<DueSchedule[]> {
      return runOperation(() =>
        options.db.transaction(async (database) => {
          let dueIds = await database.exec(
            rawSql(
              [
                `select id from ${tables.schedules} where next_run_at <= ? `,
                'and (locked_until is null or locked_until <= ?) ',
                'order by next_run_at asc limit ?',
              ].join(''),
              [input.now, input.now, input.limit],
            ),
          )

          let dueSchedules: DueSchedule[] = []

          for (let row of dueIds.rows ?? []) {
            if (typeof row.id !== 'string') {
              continue
            }

            let update = await database.exec(
              rawSql(
                [
                  `update ${tables.schedules} set locked_by = ?, locked_until = ?, updated_at = ? `,
                  'where id = ? and next_run_at <= ? and (locked_until is null or locked_until <= ?)',
                ].join(''),
                [input.workerId, input.now + input.leaseMs, input.now, row.id, input.now, input.now],
              ),
            )

            if ((update.affectedRows ?? 0) === 0) {
              continue
            }

            let scheduleRows = await database.exec(
              rawSql(`select * from ${tables.schedules} where id = ? limit 1`, [row.id]),
            )
            let scheduleRow = scheduleRows.rows?.[0]

            if (scheduleRow != null) {
              dueSchedules.push(toDueSchedule(scheduleRow))
            }
          }

          return dueSchedules
        }),
      )
    },
    advanceSchedule(input: {
      scheduleId: string
      nextRunAt: number
      now: number
      workerId: string
    }): Promise<void> {
      return runOperation(async () => {
        await options.db.exec(
          rawSql(
            [
              `update ${tables.schedules} set next_run_at = ?, locked_by = null, locked_until = null, updated_at = ? `,
              'where id = ? and locked_by = ?',
            ].join(''),
            [input.nextRunAt, input.now, input.scheduleId, input.workerId],
          ),
        )
      })
    },
  }
}

/**
 * Returns SQL statements for creating the scheduler tables in the configured dialect.
 *
 * @param dialect SQL dialect name
 * @param tablePrefix Optional table prefix
 * @returns Ordered SQL statements that create scheduler tables and indexes
 */
export function getJobSchemaSql(dialect: DataTableDialect, tablePrefix?: string): string[] {
  if (!['postgres', 'mysql', 'sqlite'].includes(dialect)) {
    throw new Error(`Unsupported dialect "${dialect}"`)
  }

  let prefix = normalizeTablePrefix(tablePrefix)
  let keyTextType = dialect === 'mysql' ? 'varchar(191)' : 'text'
  let indexedTextType = dialect === 'mysql' ? 'varchar(191)' : 'text'
  let statusTextType = dialect === 'mysql' ? 'varchar(32)' : 'text'
  let tables: BackendTables = {
    jobs: `${prefix}jobs`,
    dedupe: `${prefix}dedupe`,
    schedules: `${prefix}schedules`,
  }

  return [
    [
      `create table ${tables.jobs} (`,
      `id ${keyTextType} primary key,`,
      'name text not null,',
      `queue ${indexedTextType} not null,`,
      'payload_json text not null,',
      `status ${statusTextType} not null,`,
      'attempts integer not null,',
      'max_attempts integer not null,',
      'run_at bigint not null,',
      'priority integer not null,',
      'retry_json text not null,',
      'locked_by text,',
      'locked_until bigint,',
      'last_error text,',
      'created_at bigint not null,',
      'updated_at bigint not null,',
      'completed_at bigint,',
      'failed_at bigint',
      ')',
    ].join(' '),
    [
      `create table ${tables.dedupe} (`,
      `dedupe_key ${keyTextType} primary key,`,
      'job_id text not null,',
      'expires_at bigint not null',
      ')',
    ].join(' '),
    [
      `create table ${tables.schedules} (`,
      `id ${keyTextType} primary key,`,
      'cron text not null,',
      'timezone text not null,',
      'queue text not null,',
      'name text not null,',
      'payload_json text not null,',
      'retry_json text not null,',
      'catch_up text not null,',
      'next_run_at bigint not null,',
      'locked_by text,',
      'locked_until bigint,',
      'updated_at bigint not null',
      ')',
    ].join(' '),
    `create index ${tables.jobs}_due_idx on ${tables.jobs} (status, queue, run_at, priority, created_at)`,
    `create index ${tables.jobs}_lock_idx on ${tables.jobs} (status, locked_until)`,
    `create index ${tables.dedupe}_expires_idx on ${tables.dedupe} (expires_at)`,
    `create index ${tables.schedules}_due_idx on ${tables.schedules} (next_run_at, locked_until)`,
  ]
}

function createOperationRunner(
  dialect: DataTableDialect,
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

async function cleanupExpiredDedupe(db: Database, tables: BackendTables, now: number): Promise<void> {
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
  }
}

function toDueSchedule(row: Record<string, unknown>): DueSchedule {
  return {
    id: readString(row.id),
    cron: readString(row.cron),
    timezone: readString(row.timezone),
    queue: readString(row.queue),
    name: readString(row.name),
    payload: parseJson(row.payload_json, {}),
    retry: parseRetry(row.retry_json),
    catchUp: readCatchUp(row.catch_up),
    nextRunAt: parseInteger(row.next_run_at, 0),
    lockedBy: readString(row.locked_by),
    lockedUntil: parseInteger(row.locked_until, 0),
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

function readCatchUp(value: unknown): DueSchedule['catchUp'] {
  if (value === 'none' || value === 'one' || value === 'all') {
    return value
  }

  return 'one'
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
