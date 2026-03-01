import type {
  ClaimDueJobsInput,
  ClaimDueSchedulesInput,
  DueSchedule,
  EnqueueJobInput,
  JobStorage,
  JobWriteOptions,
  JobFailureInput,
  ListFailedJobsInput,
  ReplayFailedJobInput,
  PruneJobsInput,
  PruneJobsResult,
  PersistedCronSchedule,
} from '@remix-run/job/storage'
import type { JobRecord, ResolvedRetryPolicy } from '@remix-run/job'

let DEFAULT_PREFIX = 'job:'

let DEFAULT_RETRY: ResolvedRetryPolicy = {
  maxAttempts: 5,
  strategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  jitter: 'full',
}

export interface RedisJobStorageClient {
  sendCommand(command: string[]): Promise<unknown>
}

export interface RedisJobStorageOptions {
  redis: RedisJobStorageClient
  prefix?: string
}

/**
 * Creates a Redis-backed `JobStorage` implementation.
 *
 * @param options Storage configuration
 * @returns A `JobStorage` that persists jobs and schedules in Redis
 */
export function createRedisJobStorage(options: RedisJobStorageOptions): JobStorage {
  let redis = options.redis
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
    async replayFailedJob(
      input: ReplayFailedJobInput,
      _options?: JobWriteOptions,
    ): Promise<{ jobId: string } | null> {
      let replayedJobId = crypto.randomUUID()
      let now = Date.now()
      let result = await evalScript(
        redis,
        REPLAY_FAILED_JOB_SCRIPT,
        [
          keys.job(input.jobId),
          keys.job(replayedJobId),
          keys.jobsDue,
          keys.jobsCompleted,
          keys.jobsFailed,
          keys.jobsCanceled,
        ],
        [
          input.jobId,
          replayedJobId,
          String(now),
          String(input.runAt ?? now),
          input.priority == null ? '' : String(input.priority),
          input.queue ?? '',
        ],
      )
      let replayed = asString(result)

      if (replayed === '') {
        return null
      }

      return {
        jobId: replayed,
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
    async replaceSchedules(input: PersistedCronSchedule[]): Promise<void> {
      let desiredScheduleIds = new Set(input.map((schedule) => schedule.id))
      let existingScheduleIds = await zrange(redis, keys.schedulesDue, 0, -1)

      for (let scheduleId of existingScheduleIds) {
        if (desiredScheduleIds.has(scheduleId)) {
          continue
        }

        await redis.sendCommand(['DEL', keys.schedule(scheduleId)])
        await redis.sendCommand(['ZREM', keys.schedulesDue, scheduleId])
      }

      for (let schedule of input) {
        await evalScript(
          redis,
          UPSERT_SCHEDULE_SCRIPT,
          [keys.schedule(schedule.id), keys.schedulesDue],
          [
            schedule.id,
            schedule.schedule,
            schedule.timezone,
            schedule.queue,
            schedule.name,
            JSON.stringify(schedule.payload),
            JSON.stringify(schedule.retry),
            schedule.catchUp,
            String(schedule.nextRunAt),
            String(Date.now()),
          ],
        )
      }
    },
    async claimDueSchedules(input: ClaimDueSchedulesInput): Promise<DueSchedule[]> {
      if (input.limit <= 0) {
        return []
      }

      let result = await evalScript(
        redis,
        CLAIM_DUE_SCHEDULES_SCRIPT,
        [keys.schedulesDue, keys.schedulePrefix],
        [String(input.now), input.workerId, String(input.leaseMs), String(input.limit)],
      )
      let scheduleIds = readArray(result)
      let schedules: DueSchedule[] = []

      for (let scheduleId of scheduleIds) {
        let schedule = await getSchedule(redis, keys, scheduleId)

        if (schedule != null) {
          schedules.push(schedule)
        }
      }

      return schedules
    },
    async advanceSchedule(input: {
      scheduleId: string
      nextRunAt: number
      now: number
      workerId: string
    }): Promise<void> {
      await evalScript(
        redis,
        ADVANCE_SCHEDULE_SCRIPT,
        [keys.schedule(input.scheduleId), keys.schedulesDue],
        [input.scheduleId, input.workerId, String(input.nextRunAt), String(input.now)],
      )
    },
  }
}

type StorageKeys = {
  jobsDue: string
  jobsCompleted: string
  jobsFailed: string
  jobsCanceled: string
  schedulesDue: string
  jobPrefix: string
  schedulePrefix: string
  job: (id: string) => string
  schedule: (id: string) => string
  dedupe: (key: string) => string
}

function createKeys(prefix: string): StorageKeys {
  return {
    jobsDue: `${prefix}jobs:due`,
    jobsCompleted: `${prefix}jobs:completed`,
    jobsFailed: `${prefix}jobs:failed`,
    jobsCanceled: `${prefix}jobs:canceled`,
    schedulesDue: `${prefix}schedules:due`,
    jobPrefix: `${prefix}job:`,
    schedulePrefix: `${prefix}schedule:`,
    job(id: string): string {
      return `${prefix}job:${id}`
    },
    schedule(id: string): string {
      return `${prefix}schedule:${id}`
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

async function getSchedule(
  redis: RedisJobStorageClient,
  keys: StorageKeys,
  scheduleId: string,
): Promise<DueSchedule | null> {
  let hash = await hgetall(redis, keys.schedule(scheduleId))

  if (Object.keys(hash).length === 0) {
    return null
  }

  return toDueSchedule(hash)
}

async function hgetall(redis: RedisJobStorageClient, key: string): Promise<Record<string, string>> {
  let result = await redis.sendCommand(['HGETALL', key])
  return toHashRecord(result)
}

async function zrange(
  redis: RedisJobStorageClient,
  key: string,
  start: number,
  end: number,
): Promise<string[]> {
  let result = await redis.sendCommand(['ZRANGE', key, String(start), String(end)])
  return readArray(result)
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

function toDueSchedule(hash: Record<string, string>): DueSchedule {
  return {
    id: readRequiredString(hash.id, 'id'),
    schedule: readRequiredString(hash.schedule, 'schedule'),
    timezone: readRequiredString(hash.timezone, 'timezone'),
    queue: readRequiredString(hash.queue, 'queue'),
    name: readRequiredString(hash.name, 'name'),
    payload: parseJson(hash.payload, {}),
    retry: parseRetry(hash.retry),
    catchUp: readCatchUp(hash.catchUp),
    nextRunAt: readNumber(hash.nextRunAt, 0),
    lockedBy: readRequiredString(hash.lockedBy, 'lockedBy'),
    lockedUntil: readNumber(hash.lockedUntil, 0),
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

function readCatchUp(value: string | undefined): DueSchedule['catchUp'] {
  if (value === 'none' || value === 'one' || value === 'all') {
    return value
  }

  return 'one'
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

let ENQUEUE_JOB_SCRIPT = `
local jobKey = KEYS[1]
local dueKey = KEYS[2]
local dedupeKey = KEYS[3]
local dedupeTtlMs = tonumber(ARGV[11])

if dedupeKey ~= '' and dedupeTtlMs ~= nil and dedupeTtlMs > 0 then
  local existing = redis.call('GET', dedupeKey)
  if existing then
    return {'deduped', existing}
  end
end

redis.call(
  'HSET',
  jobKey,
  'id', ARGV[1],
  'name', ARGV[2],
  'queue', ARGV[3],
  'payload', ARGV[4],
  'status', 'queued',
  'attempts', '0',
  'maxAttempts', ARGV[5],
  'runAt', ARGV[6],
  'priority', ARGV[7],
  'retry', ARGV[8],
  'createdAt', ARGV[9],
  'updatedAt', ARGV[10],
  'lastError', '',
  'completedAt', '',
  'failedAt', '',
  'canceledAt', '',
  'lockedBy', '',
  'lockedUntil', '0'
)

redis.call('ZADD', dueKey, ARGV[6], ARGV[1])

if dedupeKey ~= '' and dedupeTtlMs ~= nil and dedupeTtlMs > 0 then
  redis.call('SET', dedupeKey, ARGV[1], 'PX', ARGV[11], 'NX')
end

return {'enqueued', ARGV[1]}
`

let CANCEL_JOB_SCRIPT = `
local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local now = ARGV[2]

local status = redis.call('HGET', jobKey, 'status')
if status ~= 'queued' then
  return 0
end

redis.call(
  'HSET',
  jobKey,
  'status', 'canceled',
  'canceledAt', now,
  'completedAt', '',
  'failedAt', '',
  'lockedBy', '',
  'lockedUntil', '0',
  'updatedAt', now
)
redis.call('ZREM', dueKey, jobId)
redis.call('ZREM', completedKey, jobId)
redis.call('ZREM', failedKey, jobId)
redis.call('ZADD', canceledKey, now, jobId)

return 1
`

let CLAIM_DUE_JOBS_SCRIPT = `
local dueKey = KEYS[1]
local jobPrefix = KEYS[2]
local now = tonumber(ARGV[1])
local workerId = ARGV[2]
local leaseMs = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])
local queueCount = tonumber(ARGV[5])

if limit <= 0 then
  return {}
end

local scanLimit = math.max(limit * 8, limit)
local candidates = redis.call('ZRANGEBYSCORE', dueKey, '-inf', now, 'LIMIT', 0, scanLimit)
local claimed = {}

for _, jobId in ipairs(candidates) do
  if #claimed >= limit then
    break
  end

  local jobKey = jobPrefix .. jobId
  local values = redis.call('HMGET', jobKey, 'status', 'queue', 'runAt', 'lockedUntil', 'attempts')
  local status = values[1]
  local queue = values[2]
  local runAt = tonumber(values[3] or '0')
  local lockedUntil = tonumber(values[4] or '0')

  local queueAllowed = false

  for queueIndex = 1, queueCount do
    if queue == ARGV[5 + queueIndex] then
      queueAllowed = true
      break
    end
  end

  if queueAllowed and runAt <= now then
    local claimable = false

    if status == 'queued' then
      claimable = true
    elseif status == 'running' and lockedUntil <= now then
      claimable = true
    end

    if claimable then
      local attempts = tonumber(values[5] or '0') + 1
      local lockedExpiry = now + leaseMs

      redis.call(
        'HSET',
        jobKey,
        'status', 'running',
        'lockedBy', workerId,
        'lockedUntil', tostring(lockedExpiry),
        'attempts', tostring(attempts),
        'updatedAt', tostring(now)
      )
      redis.call('ZADD', dueKey, lockedExpiry, jobId)

      table.insert(claimed, jobId)
    end
  end
end

return claimed
`

let HEARTBEAT_JOB_SCRIPT = `
local jobKey = KEYS[1]
local dueKey = KEYS[2]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = tonumber(ARGV[3])
local leaseMs = tonumber(ARGV[4])

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy', 'lockedUntil')
local status = values[1]
local lockedBy = values[2]
local lockedUntil = tonumber(values[3] or '0')

if status ~= 'running' or lockedBy ~= workerId or lockedUntil <= now then
  return 0
end

local nextLock = now + leaseMs

redis.call(
  'HSET',
  jobKey,
  'lockedUntil', tostring(nextLock),
  'updatedAt', tostring(now)
)
redis.call('ZADD', dueKey, nextLock, jobId)

return 1
`

let COMPLETE_JOB_SCRIPT = `
local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = ARGV[3]

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy')
if values[1] ~= 'running' or values[2] ~= workerId then
  return 0
end

redis.call(
  'HSET',
  jobKey,
  'status', 'completed',
  'lockedBy', '',
  'lockedUntil', '0',
  'failedAt', '',
  'canceledAt', '',
  'updatedAt', now,
  'completedAt', now
)
redis.call('ZREM', dueKey, jobId)
redis.call('ZADD', completedKey, now, jobId)
redis.call('ZREM', failedKey, jobId)
redis.call('ZREM', canceledKey, jobId)

return 1
`

let FAIL_JOB_SCRIPT = `
local jobKey = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local jobId = ARGV[1]
local workerId = ARGV[2]
local now = ARGV[3]
local error = ARGV[4]
local terminal = ARGV[5]
local retryAt = ARGV[6]

local values = redis.call('HMGET', jobKey, 'status', 'lockedBy')
if values[1] ~= 'running' or values[2] ~= workerId then
  return 0
end

if terminal == '1' then
  redis.call(
    'HSET',
    jobKey,
    'status', 'failed',
    'lockedBy', '',
    'lockedUntil', '0',
    'completedAt', '',
    'canceledAt', '',
    'updatedAt', now,
    'failedAt', now,
    'lastError', error
  )
  redis.call('ZREM', dueKey, jobId)
  redis.call('ZREM', completedKey, jobId)
  redis.call('ZREM', canceledKey, jobId)
  redis.call('ZADD', failedKey, now, jobId)
else
  redis.call(
    'HSET',
    jobKey,
    'status', 'queued',
    'runAt', retryAt,
    'lockedBy', '',
    'lockedUntil', '0',
    'completedAt', '',
    'failedAt', '',
    'canceledAt', '',
    'updatedAt', now,
    'lastError', error
  )
  redis.call('ZADD', dueKey, retryAt, jobId)
  redis.call('ZREM', completedKey, jobId)
  redis.call('ZREM', failedKey, jobId)
  redis.call('ZREM', canceledKey, jobId)
end

return 1
`

let LIST_FAILED_JOBS_SCRIPT = `
local failedKey = KEYS[1]
local jobPrefix = KEYS[2]
local limit = tonumber(ARGV[1])
local queueFilter = ARGV[2]

if limit == nil or limit <= 0 then
  return {}
end

local scanLimit = math.max(limit * 8, limit)
local failedIds = redis.call('ZREVRANGE', failedKey, 0, scanLimit - 1)
local selected = {}

for _, jobId in ipairs(failedIds) do
  if #selected >= limit then
    break
  end

  local queue = redis.call('HGET', jobPrefix .. jobId, 'queue')

  if queue ~= false and (queueFilter == '' or queue == queueFilter) then
    table.insert(selected, jobId)
  end
end

return selected
`

let REPLAY_FAILED_JOB_SCRIPT = `
local sourceJobKey = KEYS[1]
local replayJobKey = KEYS[2]
local dueKey = KEYS[3]
local completedKey = KEYS[4]
local failedKey = KEYS[5]
local canceledKey = KEYS[6]
local sourceJobId = ARGV[1]
local replayJobId = ARGV[2]
local now = ARGV[3]
local runAt = ARGV[4]
local priorityOverride = ARGV[5]
local queueOverride = ARGV[6]

local sourceValues = redis.call(
  'HMGET',
  sourceJobKey,
  'status',
  'name',
  'queue',
  'payload',
  'maxAttempts',
  'priority',
  'retry'
)

if sourceValues[1] ~= 'failed' then
  return ''
end

local sourceName = sourceValues[2]
local sourceQueue = sourceValues[3]
local sourcePayload = sourceValues[4]
local sourceMaxAttempts = sourceValues[5]
local sourcePriority = sourceValues[6]
local sourceRetry = sourceValues[7]

if sourceName == false or sourceQueue == false or sourcePayload == false or sourceMaxAttempts == false or sourcePriority == false or sourceRetry == false then
  return ''
end

local queue = sourceQueue
if queueOverride ~= '' then
  queue = queueOverride
end

local priority = sourcePriority
if priorityOverride ~= '' then
  priority = priorityOverride
end

redis.call(
  'HSET',
  replayJobKey,
  'id', replayJobId,
  'name', sourceName,
  'queue', queue,
  'payload', sourcePayload,
  'status', 'queued',
  'attempts', '0',
  'maxAttempts', sourceMaxAttempts,
  'runAt', runAt,
  'priority', priority,
  'retry', sourceRetry,
  'createdAt', now,
  'updatedAt', now,
  'lastError', '',
  'completedAt', '',
  'failedAt', '',
  'canceledAt', '',
  'lockedBy', '',
  'lockedUntil', '0'
)

redis.call('ZADD', dueKey, runAt, replayJobId)
redis.call('ZREM', completedKey, replayJobId)
redis.call('ZREM', failedKey, replayJobId)
redis.call('ZREM', canceledKey, replayJobId)

return replayJobId
`

let PRUNE_JOBS_SCRIPT = `
local jobPrefix = KEYS[1]
local dueKey = KEYS[2]
local completedKey = KEYS[3]
local failedKey = KEYS[4]
local canceledKey = KEYS[5]
local completedBefore = tonumber(ARGV[1])
local failedBefore = tonumber(ARGV[2])
local canceledBefore = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

if limit == nil or limit <= 0 then
  return {0, 0, 0, 0}
end

local deleted = 0
local completedDeleted = 0
local failedDeleted = 0
local canceledDeleted = 0

local function pruneFromSet(setKey, cutoff, remaining)
  if cutoff == nil or cutoff < 0 or remaining <= 0 then
    return {}
  end

  return redis.call('ZRANGEBYSCORE', setKey, '-inf', cutoff, 'LIMIT', 0, remaining)
end

local function pruneIds(ids, setKey)
  for _, jobId in ipairs(ids) do
    redis.call('DEL', jobPrefix .. jobId)
    redis.call('ZREM', dueKey, jobId)
    redis.call('ZREM', completedKey, jobId)
    redis.call('ZREM', failedKey, jobId)
    redis.call('ZREM', canceledKey, jobId)
  end

  return #ids
end

local completedIds = pruneFromSet(completedKey, completedBefore, limit - deleted)
local completedCount = pruneIds(completedIds, completedKey)
deleted = deleted + completedCount
completedDeleted = completedDeleted + completedCount

local failedIds = pruneFromSet(failedKey, failedBefore, limit - deleted)
local failedCount = pruneIds(failedIds, failedKey)
deleted = deleted + failedCount
failedDeleted = failedDeleted + failedCount

local canceledIds = pruneFromSet(canceledKey, canceledBefore, limit - deleted)
local canceledCount = pruneIds(canceledIds, canceledKey)
deleted = deleted + canceledCount
canceledDeleted = canceledDeleted + canceledCount

return {deleted, completedDeleted, failedDeleted, canceledDeleted}
`

let UPSERT_SCHEDULE_SCRIPT = `
local scheduleKey = KEYS[1]
local dueKey = KEYS[2]

local currentNextRunAt = tonumber(redis.call('HGET', scheduleKey, 'nextRunAt') or '-1')
local requestedNextRunAt = tonumber(ARGV[9])

if currentNextRunAt ~= nil and currentNextRunAt >= 0 and currentNextRunAt < requestedNextRunAt then
  requestedNextRunAt = currentNextRunAt
end

redis.call(
  'HSET',
  scheduleKey,
  'id', ARGV[1],
  'schedule', ARGV[2],
  'timezone', ARGV[3],
  'queue', ARGV[4],
  'name', ARGV[5],
  'payload', ARGV[6],
  'retry', ARGV[7],
  'catchUp', ARGV[8],
  'nextRunAt', tostring(requestedNextRunAt),
  'lockedBy', '',
  'lockedUntil', '0',
  'updatedAt', ARGV[10]
)

redis.call('ZADD', dueKey, requestedNextRunAt, ARGV[1])

return tostring(requestedNextRunAt)
`

let CLAIM_DUE_SCHEDULES_SCRIPT = `
local dueKey = KEYS[1]
local schedulePrefix = KEYS[2]
local now = tonumber(ARGV[1])
local workerId = ARGV[2]
local leaseMs = tonumber(ARGV[3])
local limit = tonumber(ARGV[4])

if limit <= 0 then
  return {}
end

local scanLimit = math.max(limit * 8, limit)
local candidates = redis.call('ZRANGEBYSCORE', dueKey, '-inf', now, 'LIMIT', 0, scanLimit)
local claimed = {}

for _, scheduleId in ipairs(candidates) do
  if #claimed >= limit then
    break
  end

  local scheduleKey = schedulePrefix .. scheduleId
  local values = redis.call('HMGET', scheduleKey, 'nextRunAt', 'lockedUntil')
  local nextRunAt = tonumber(values[1] or '0')
  local lockedUntil = tonumber(values[2] or '0')

  if nextRunAt <= now and lockedUntil <= now then
    local nextLock = now + leaseMs

    redis.call(
      'HSET',
      scheduleKey,
      'lockedBy', workerId,
      'lockedUntil', tostring(nextLock),
      'updatedAt', tostring(now)
    )
    redis.call('ZADD', dueKey, nextLock, scheduleId)

    table.insert(claimed, scheduleId)
  end
end

return claimed
`

let ADVANCE_SCHEDULE_SCRIPT = `
local scheduleKey = KEYS[1]
local dueKey = KEYS[2]
local scheduleId = ARGV[1]
local workerId = ARGV[2]
local nextRunAt = ARGV[3]
local now = ARGV[4]

local lockedBy = redis.call('HGET', scheduleKey, 'lockedBy')
if lockedBy ~= workerId then
  return 0
end

redis.call(
  'HSET',
  scheduleKey,
  'nextRunAt', nextRunAt,
  'lockedBy', '',
  'lockedUntil', '0',
  'updatedAt', now
)
redis.call('ZADD', dueKey, nextRunAt, scheduleId)

return 1
`
