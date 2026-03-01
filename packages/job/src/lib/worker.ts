import { parse } from '@remix-run/data-schema'

import type { DueSchedule, PersistedCronSchedule } from './storage.ts'
import type {
  CreateJobWorkerOptions,
  CronSchedule,
  JobDefinitions,
  JobRecord,
  JobWorker,
  PrunePolicy,
  RetryPolicy,
  WorkerHookName,
  WorkerHooks,
  WorkerOptions,
} from './types.ts'
import { getCronDispatchCount, getNextCronRunAt } from './cron.ts'
import { computeRetryAt, normalizeRetryPolicy } from './retry.ts'

let DEFAULT_CONCURRENCY = 10
let DEFAULT_POLL_INTERVAL_MS = 1000
let DEFAULT_LEASE_MS = 30000
let DEFAULT_CRON_TICK_MS = 30000
let DEFAULT_RETENTION_INTERVAL_MS = 60000
let DEFAULT_RETENTION_LIMIT = 500

/**
 * Creates a worker loop that claims and executes jobs from a scheduler storage.
 *
 * @param options Worker configuration
 * @returns A `JobWorker` lifecycle controller
 */
export function createJobWorker<
  defs extends JobDefinitions,
  transaction = never,
>(
  options: CreateJobWorkerOptions<defs, transaction>,
): JobWorker {
  let jobs = options.jobs
  let jobNames = createJobNameMap(jobs)
  let storage = options.storage
  let hooks = options
  let workerOptions = normalizeWorkerOptions(options.worker)

  let running = false
  let stopped = false
  let inFlight = new Set<Promise<void>>()
  let jobControllers = new Map<string, AbortController>()

  let loopAbort = new AbortController()
  let workLoopPromise: Promise<void> | undefined
  let cronLoopPromise: Promise<void> | undefined
  let retentionLoopPromise: Promise<void> | undefined

  let cronSchedules = options.cron ?? []

  async function start(): Promise<void> {
    if (running) {
      return
    }

    if (stopped) {
      throw new Error('Worker cannot be started after stop()')
    }

    running = true

    if (cronSchedules.length > 0) {
      await storage.upsertSchedules(
        cronSchedules.map((schedule) => toPersistedSchedule(schedule, Date.now(), jobNames)),
      )
      cronLoopPromise = runCronLoop()
    }

    if (workerOptions.retention != null) {
      retentionLoopPromise = runRetentionLoop()
    }

    workLoopPromise = runWorkLoop()
  }

  async function stop(): Promise<void> {
    if (!running) {
      stopped = true
      return
    }

    running = false
    stopped = true
    loopAbort.abort()

    for (let controller of jobControllers.values()) {
      controller.abort(new Error('Worker stopped'))
    }

    await Promise.all([workLoopPromise, cronLoopPromise, retentionLoopPromise])
  }

  async function drain(timeoutMs = 30000): Promise<void> {
    let startTime = Date.now()

    while (inFlight.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timed out waiting for ${inFlight.size} running job(s) to finish`)
      }

      await sleep(20)
    }
  }

  async function runWorkLoop(): Promise<void> {
    while (running) {
      let available = workerOptions.concurrency - inFlight.size

      if (available > 0) {
        let claimedJobs = await storage.claimDueJobs({
          now: Date.now(),
          workerId: workerOptions.workerId,
          queues: workerOptions.queues,
          limit: available,
          leaseMs: workerOptions.leaseMs,
        })

        for (let job of claimedJobs) {
          let task = processJob(job)
          inFlight.add(task)

          task.finally(() => {
            inFlight.delete(task)
          })
        }
      }

      await sleep(workerOptions.pollIntervalMs, loopAbort.signal)
    }
  }

  async function runCronLoop(): Promise<void> {
    while (running) {
      let dueSchedules = await storage.claimDueSchedules({
        now: Date.now(),
        workerId: workerOptions.workerId,
        leaseMs: workerOptions.leaseMs,
        limit: 25,
      })

      for (let schedule of dueSchedules) {
        await processSchedule(schedule)
      }

      await sleep(workerOptions.cronTickMs, loopAbort.signal)
    }
  }

  async function runRetentionLoop(): Promise<void> {
    if (workerOptions.retention == null) {
      return
    }

    while (running) {
      let now = Date.now()
      let retention = workerOptions.retention
      let result = await storage.prune({
        completedBefore: resolvePruneCutoff(now, retention.policy.completedOlderThanMs),
        failedBefore: resolvePruneCutoff(now, retention.policy.failedOlderThanMs),
        canceledBefore: resolvePruneCutoff(now, retention.policy.canceledOlderThanMs),
        limit: retention.limit,
      })

      await runWorkerHook(hooks, 'onPrune', {
        workerId: workerOptions.workerId,
        policy: retention.policy,
        limit: retention.limit,
        result,
      })

      await sleep(retention.intervalMs, loopAbort.signal)
    }
  }

  async function processSchedule(schedule: DueSchedule): Promise<void> {
    let now = Date.now()
    let definition = jobs[schedule.name]

    if (definition == null) {
      await storage.advanceSchedule({
        scheduleId: schedule.id,
        nextRunAt: getNextCronRunAt(schedule.schedule, now, schedule.timezone),
        now,
        workerId: workerOptions.workerId,
      })
      return
    }

    let payload = parse(definition.schema, schedule.payload)
    let dispatchCount = getCronDispatchCount(
      schedule.schedule,
      schedule.timezone,
      schedule.catchUp,
      schedule.nextRunAt,
      now,
    )
    let dispatchIndex = 0

    while (dispatchIndex < dispatchCount) {
      let now = Date.now()
      let retry = normalizeRetryPolicy(definition.retry, schedule.retry)

      await storage.enqueue({
        name: schedule.name,
        queue: schedule.queue,
        payload,
        runAt: now,
        priority: 0,
        retry,
        createdAt: now,
      })
      dispatchIndex += 1
    }

    let nextRunAt = getNextCronRunAt(schedule.schedule, now, schedule.timezone)

    await storage.advanceSchedule({
      scheduleId: schedule.id,
      nextRunAt,
      now,
      workerId: workerOptions.workerId,
    })
  }

  async function processJob(job: JobRecord): Promise<void> {
    let definition = jobs[job.name]
    let startedAt = Date.now()

    if (definition == null) {
      let error = `Unknown job "${job.name}"`
      let now = Date.now()

      await storage.fail({
        jobId: job.id,
        workerId: workerOptions.workerId,
        now,
        error,
        terminal: true,
      })
      await runWorkerHook(hooks, 'onJobFailed', {
        job: {
          ...job,
          status: 'failed',
          failedAt: now,
          updatedAt: now,
          lastError: error,
        },
        workerId: workerOptions.workerId,
        error,
      })
      return
    }

    let controller = new AbortController()
    jobControllers.set(job.id, controller)

    let heartbeatTimer = setInterval(() => {
      void storage.heartbeat({
        jobId: job.id,
        workerId: workerOptions.workerId,
        leaseMs: workerOptions.leaseMs,
        now: Date.now(),
      })
    }, workerOptions.heartbeatMs)

    try {
      await runWorkerHook(hooks, 'onJobStart', {
        job,
        workerId: workerOptions.workerId,
      })

      let parsedPayload = parse(definition.schema, job.payload)
      await definition.handle(parsedPayload, {
        signal: controller.signal,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        queue: job.queue,
        workerId: workerOptions.workerId,
        scheduledAt: job.runAt,
      })

      await storage.complete({
        jobId: job.id,
        workerId: workerOptions.workerId,
        now: Date.now(),
      })
      let completedAt = Date.now()

      await runWorkerHook(hooks, 'onJobComplete', {
        job: {
          ...job,
          status: 'completed',
          completedAt,
          updatedAt: completedAt,
          lastError: undefined,
        },
        workerId: workerOptions.workerId,
        durationMs: completedAt - startedAt,
      })
    } catch (error) {
      let now = Date.now()
      let message = normalizeErrorMessage(error)

      if (job.attempts >= job.maxAttempts) {
        await storage.fail({
          jobId: job.id,
          workerId: workerOptions.workerId,
          now,
          error: message,
          terminal: true,
        })
        await runWorkerHook(hooks, 'onJobFailed', {
          job: {
            ...job,
            status: 'failed',
            failedAt: now,
            updatedAt: now,
            lastError: message,
          },
          workerId: workerOptions.workerId,
          error: message,
        })
      } else {
        let retryAt = computeRetryAt(now, job.attempts, job.retry)

        await storage.fail({
          jobId: job.id,
          workerId: workerOptions.workerId,
          now,
          error: message,
          retryAt,
          terminal: false,
        })
        await runWorkerHook(hooks, 'onJobRetry', {
          job: {
            ...job,
            status: 'queued',
            runAt: retryAt,
            updatedAt: now,
            lastError: message,
          },
          workerId: workerOptions.workerId,
          retryAt,
          error: message,
        })
      }
    } finally {
      clearInterval(heartbeatTimer)
      jobControllers.delete(job.id)
    }
  }

  return {
    start,
    stop,
    drain,
  }
}

type NormalizedWorkerOptions = {
  workerId: string
  queues: string[]
  concurrency: number
  pollIntervalMs: number
  leaseMs: number
  heartbeatMs: number
  cronTickMs: number
  retention?: {
    policy: PrunePolicy
    intervalMs: number
    limit: number
  }
}

function normalizeWorkerOptions(options?: WorkerOptions): NormalizedWorkerOptions {
  let leaseMs = normalizeWholeNumber(options?.leaseMs, DEFAULT_LEASE_MS, 1)
  let retention = normalizeRetentionOptions(options?.retention)

  return {
    workerId: options?.workerId ?? crypto.randomUUID(),
    queues: options?.queues ?? ['default'],
    concurrency: normalizeWholeNumber(options?.concurrency, DEFAULT_CONCURRENCY, 1),
    pollIntervalMs: normalizeWholeNumber(options?.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 1),
    leaseMs,
    heartbeatMs: normalizeWholeNumber(
      options?.heartbeatMs,
      Math.max(1000, Math.floor(leaseMs / 2)),
      1,
    ),
    cronTickMs: normalizeWholeNumber(options?.cronTickMs, DEFAULT_CRON_TICK_MS, 1),
    retention,
  }
}

function normalizeRetentionOptions(options: WorkerOptions['retention']): NormalizedWorkerOptions['retention'] {
  if (options == null) {
    return undefined
  }

  return {
    policy: options.policy,
    intervalMs: normalizeWholeNumber(options.intervalMs, DEFAULT_RETENTION_INTERVAL_MS, 1),
    limit: normalizeWholeNumber(options.limit, DEFAULT_RETENTION_LIMIT, 1),
  }
}

function toPersistedSchedule<defs extends JobDefinitions>(
  schedule: CronSchedule<defs>,
  now: number,
  jobNames: WeakMap<object, string>,
): PersistedCronSchedule {
  let timeZone = schedule.options.timezone ?? 'UTC'
  let retry = normalizeRetryPolicy(undefined, schedule.options.retry as RetryPolicy | undefined)
  let jobName = resolveJobName(schedule.job, jobNames)

  return {
    id: schedule.options.id,
    schedule: schedule.schedule,
    timezone: timeZone,
    queue: schedule.options.queue ?? 'default',
    name: jobName,
    payload: schedule.payload,
    retry,
    catchUp: schedule.options.catchUp ?? 'one',
    nextRunAt: getNextCronRunAt(schedule.schedule, now - 60000, timeZone),
  }
}

function createJobNameMap<defs extends JobDefinitions>(jobs: defs): WeakMap<object, string> {
  let jobNames = new WeakMap<object, string>()

  for (let name in jobs) {
    let definition = jobs[name]
    jobNames.set(definition, name)
  }

  return jobNames
}

function resolveJobName(value: object, jobNames: WeakMap<object, string>): string {
  let jobName = jobNames.get(value)

  if (jobName == null) {
    throw new Error('Unknown job definition passed to cron schedule')
  }

  return jobName
}

function normalizeWholeNumber(value: unknown, fallback: number, minValue: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  let normalized = Math.floor(value)

  if (normalized < minValue) {
    return minValue
  }

  return normalized
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message
  }

  return String(error)
}

function resolvePruneCutoff(now: number, olderThanMs: number | undefined): number | undefined {
  if (olderThanMs == null) {
    return undefined
  }

  return now - normalizeWholeNumber(olderThanMs, 0, 0)
}

async function runWorkerHook<defs extends JobDefinitions>(
  hooks: WorkerHooks<defs> | undefined,
  hook: WorkerHookName,
  event: unknown,
): Promise<void> {
  if (hooks == null) {
    return
  }

  let callback = hooks[hook]

  if (callback == null) {
    return
  }

  try {
    await callback(event as never)
  } catch (error) {
    if (hooks.onHookError == null) {
      return
    }

    try {
      await hooks.onHookError({
        hook,
        event,
        error,
      })
    } catch {
      // Hook errors are fail-open by design.
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }

    let timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    let onAbort = () => {
      clearTimeout(timeout)
      cleanup()
      resolve()
    }

    function cleanup(): void {
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
