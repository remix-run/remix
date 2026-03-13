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
import {
  CANCEL_JOB_SCRIPT,
  CLAIM_DUE_JOBS_SCRIPT,
  COMPLETE_JOB_SCRIPT,
  ENQUEUE_JOB_SCRIPT,
  FAIL_JOB_SCRIPT,
  HEARTBEAT_JOB_SCRIPT,
  LIST_FAILED_JOBS_SCRIPT,
  PRUNE_JOBS_SCRIPT,
  RETRY_FAILED_JOB_SCRIPT,
} from './generated-lua.ts'

let DEFAULT_PREFIX = 'job:'

let DEFAULT_RETRY: ResolvedRetryPolicy = {
  maxAttempts: 5,
  strategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  jitter: 'full',
}

export interface RedisJobStorageClient {
  /**
   * Sends a raw Redis command and returns the decoded result.
   */
  sendCommand(command: string[]): Promise<unknown>
}

export interface RedisJobStorageOptions {
  /**
   * Prefix applied to all Redis keys managed by the storage. Defaults to `"job:"`.
   */
  prefix?: string
}

/**
 * Creates a Redis-backed `JobStorage` implementation.
 *
 * @param redis Redis client or compatible adapter used to execute commands
 * @param options Optional storage configuration
 * @returns A `JobStorage` that persists jobs in Redis
 */
export function createRedisJobStorage(
  redis: RedisJobStorageClient,
  options: RedisJobStorageOptions = {},
): JobStorage {
  let keys = createKeys(normalizePrefix(options.prefix))

  return {
    async enqueue(
      input: EnqueueJobInput,
      _options?: JobWriteOptions,
    ): Promise<{ jobId: string; deduped: boolean }> {
      let jobId = crypto.randomUUID()
      let dedupeTtlMs = input.dedupeKey != null && input.dedupeTtlMs != null ? input.dedupeTtlMs : 0
      let dedupeKey =
        input.dedupeKey != null && dedupeTtlMs > 0 ? keys.dedupe(input.dedupeKey) : ''
      let result = await evalScript(redis, ENQUEUE_JOB_SCRIPT, [keys.job(jobId), keys.jobsDue, dedupeKey], [
        jobId,
        input.name,
        input.queue,
        JSON.stringify(input.payload),
        String(input.retry.maxAttempts),
        String(input.runAt),
        String(input.priority),
        JSON.stringify(input.retry),
        String(input.createdAt),
        String(input.createdAt),
        String(dedupeTtlMs),
      ])
      let [status, value] = readTuple(result)

      if (status === 'deduped') {
        return {
          jobId: value,
          deduped: true,
        }
      }

      if (status === 'enqueued') {
        return {
          jobId: value,
          deduped: false,
        }
      }

      throw new Error('Invalid enqueue response from redis storage')
    },
    async get(jobId: string): Promise<JobRecord | null> {
      let hash = await hgetall(redis, keys.job(jobId))

      if (Object.keys(hash).length === 0) {
        return null
      }

      return toJobRecord(hash)
    },
    async cancel(jobId: string, _options?: JobWriteOptions): Promise<boolean> {
      let now = Date.now()
      let result = await evalScript(
        redis,
        CANCEL_JOB_SCRIPT,
        [keys.job(jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled],
        [jobId, String(now)],
      )

      return readNumber(result) === 1
    },
    async listFailedJobs(input: ListFailedJobsInput): Promise<JobRecord[]> {
      let result = await evalScript(
        redis,
        LIST_FAILED_JOBS_SCRIPT,
        [keys.jobsFailed, keys.jobPrefix],
        [String(input.limit ?? 50), input.queue ?? ''],
      )
      let jobIds = readArray(result)
      let jobs: JobRecord[] = []

      for (let jobId of jobIds) {
        let job = await getJobRecord(redis, keys, jobId)

        if (job != null) {
          jobs.push(job)
        }
      }

      return jobs
    },
    async retryFailedJob(
      input: RetryFailedJobInput,
      _options?: JobWriteOptions,
    ): Promise<{ jobId: string } | null> {
      let retriedJobId = crypto.randomUUID()
      let now = Date.now()
      let result = await evalScript(
        redis,
        RETRY_FAILED_JOB_SCRIPT,
        [
          keys.job(input.jobId),
          keys.job(retriedJobId),
          keys.jobsDue,
          keys.jobsCompleted,
          keys.jobsFailed,
          keys.jobsCanceled,
        ],
        [
          input.jobId,
          retriedJobId,
          String(now),
          String(input.runAt ?? now),
          input.priority == null ? '' : String(input.priority),
          input.queue ?? '',
        ],
      )
      let retried = asString(result)

      if (retried === '') {
        return null
      }

      return {
        jobId: retried,
      }
    },
    async prune(input: PruneJobsInput, _options?: JobWriteOptions): Promise<PruneJobsResult> {
      let result = await evalScript(
        redis,
        PRUNE_JOBS_SCRIPT,
        [keys.jobPrefix, keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled],
        [
          input.completedBefore == null ? '-1' : String(input.completedBefore),
          input.failedBefore == null ? '-1' : String(input.failedBefore),
          input.canceledBefore == null ? '-1' : String(input.canceledBefore),
          String(input.limit),
        ],
      )
      return readPruneJobsResult(result)
    },
    async claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]> {
      if (input.queues.length === 0 || input.limit <= 0) {
        return []
      }

      let queueCount = String(input.queues.length)
      let result = await evalScript(
        redis,
        CLAIM_DUE_JOBS_SCRIPT,
        [keys.jobsDue, keys.jobPrefix],
        [
          String(input.now),
          input.workerId,
          String(input.leaseMs),
          String(input.limit),
          queueCount,
          ...input.queues,
        ],
      )
      let jobIds = readArray(result)
      let jobs: JobRecord[] = []

      for (let jobId of jobIds) {
        let job = await getJobRecord(redis, keys, jobId)

        if (job != null) {
          jobs.push(job)
        }
      }

      return jobs
    },
    async heartbeat(input: {
      jobId: string
      workerId: string
      leaseMs: number
      now: number
    }): Promise<boolean> {
      let result = await evalScript(redis, HEARTBEAT_JOB_SCRIPT, [keys.job(input.jobId), keys.jobsDue], [
        input.jobId,
        input.workerId,
        String(input.now),
        String(input.leaseMs),
      ])

      return readNumber(result) === 1
    },
    async complete(input: { jobId: string; workerId: string; now: number }): Promise<void> {
      await evalScript(
        redis,
        COMPLETE_JOB_SCRIPT,
        [keys.job(input.jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled],
        [input.jobId, input.workerId, String(input.now)],
      )
    },
    async fail(input: JobFailureInput): Promise<void> {
      await evalScript(
        redis,
        FAIL_JOB_SCRIPT,
        [keys.job(input.jobId), keys.jobsDue, keys.jobsCompleted, keys.jobsFailed, keys.jobsCanceled],
        [
          input.jobId,
          input.workerId,
          String(input.now),
          input.error,
          input.terminal ? '1' : '0',
          String(input.retryAt ?? input.now),
        ],
      )
    },
  }
}

type StorageKeys = {
  jobsDue: string
  jobsCompleted: string
  jobsFailed: string
  jobsCanceled: string
  jobPrefix: string
  job: (id: string) => string
  dedupe: (key: string) => string
}

function createKeys(prefix: string): StorageKeys {
  return {
    jobsDue: `${prefix}jobs:due`,
    jobsCompleted: `${prefix}jobs:completed`,
    jobsFailed: `${prefix}jobs:failed`,
    jobsCanceled: `${prefix}jobs:canceled`,
    jobPrefix: `${prefix}job:`,
    job(id: string): string {
      return `${prefix}job:${id}`
    },
    dedupe(key: string): string {
      return `${prefix}dedupe:${key}`
    },
  }
}

async function getJobRecord(
  redis: RedisJobStorageClient,
  keys: StorageKeys,
  jobId: string,
): Promise<JobRecord | null> {
  let hash = await hgetall(redis, keys.job(jobId))

  if (Object.keys(hash).length === 0) {
    return null
  }

  return toJobRecord(hash)
}

async function hgetall(redis: RedisJobStorageClient, key: string): Promise<Record<string, string>> {
  let result = await redis.sendCommand(['HGETALL', key])
  return toHashRecord(result)
}

async function evalScript(
  redis: RedisJobStorageClient,
  script: string,
  keys: string[],
  args: string[],
): Promise<unknown> {
  return redis.sendCommand(['EVAL', script, String(keys.length), ...keys, ...args])
}

function toJobRecord(hash: Record<string, string>): JobRecord {
  return {
    id: readRequiredString(hash.id, 'id'),
    name: readRequiredString(hash.name, 'name'),
    queue: readRequiredString(hash.queue, 'queue'),
    payload: parseJson(hash.payload, {}),
    status: readJobStatus(hash.status),
    attempts: readNumber(hash.attempts, 0),
    maxAttempts: readNumber(hash.maxAttempts, 1),
    runAt: readNumber(hash.runAt, 0),
    priority: readNumber(hash.priority, 0),
    retry: parseRetry(hash.retry),
    createdAt: readNumber(hash.createdAt, 0),
    updatedAt: readNumber(hash.updatedAt, 0),
    lastError: hash.lastError === '' || hash.lastError == null ? undefined : hash.lastError,
    completedAt: readOptionalNumber(hash.completedAt),
    failedAt: readOptionalNumber(hash.failedAt),
    canceledAt: readOptionalNumber(hash.canceledAt),
  }
}

function readJobStatus(value: string | undefined): JobRecord['status'] {
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

function parseRetry(value: string | undefined): ResolvedRetryPolicy {
  let parsed = parseJson(value, null)

  if (parsed == null || typeof parsed !== 'object') {
    return DEFAULT_RETRY
  }

  let retry = parsed as Record<string, unknown>

  return {
    maxAttempts: readNumber(retry.maxAttempts, DEFAULT_RETRY.maxAttempts),
    strategy: retry.strategy === 'fixed' ? 'fixed' : 'exponential',
    baseDelayMs: readNumber(retry.baseDelayMs, DEFAULT_RETRY.baseDelayMs),
    maxDelayMs: readNumber(retry.maxDelayMs, DEFAULT_RETRY.maxDelayMs),
    jitter: retry.jitter === 'none' ? 'none' : 'full',
  }
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string' || value === '') {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing redis field "${name}"`)
  }

  return value
}

function readNumber(value: unknown, fallback = 0): number {
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

function readOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined
  }

  return readNumber(value, 0)
}

function readPruneJobsResult(value: unknown): PruneJobsResult {
  let values = readArray(value)

  return {
    deleted: readNumber(values[0], 0),
    completed: readNumber(values[1], 0),
    failed: readNumber(values[2], 0),
    canceled: readNumber(values[3], 0),
  }
}

function readTuple(value: unknown): [string, string] {
  let values = readArray(value)

  if (values.length < 2) {
    throw new Error('Expected redis response tuple')
  }

  return [values[0], values[1]]
}

function readArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => asString(entry))
}

function toHashRecord(value: unknown): Record<string, string> {
  if (value == null) {
    return {}
  }

  if (Array.isArray(value)) {
    let record: Record<string, string> = {}
    let index = 0

    while (index < value.length - 1) {
      let key = asString(value[index])
      let entry = asString(value[index + 1])
      record[key] = entry
      index += 2
    }

    return record
  }

  if (typeof value === 'object') {
    let record: Record<string, string> = {}

    for (let [key, entry] of Object.entries(value as Record<string, unknown>)) {
      record[key] = asString(entry)
    }

    return record
  }

  return {}
}

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }

  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value)
  }

  return ''
}

function normalizePrefix(value: string | undefined): string {
  if (value == null || value === '') {
    return DEFAULT_PREFIX
  }

  if (/\s/.test(value)) {
    throw new Error('Redis prefix cannot contain whitespace')
  }

  return value
}
