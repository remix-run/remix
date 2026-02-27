import { parse } from '@remix-run/data-schema'

import type { DueSchedule, PersistedCronSchedule } from './backend.ts'
import type {
  CreateJobWorkerOptions,
  CronSchedule,
  JobDefinitions,
  JobRecord,
  JobWorker,
  RetryPolicy,
  WorkerOptions,
} from './types.ts'
import { getCronDispatchCount, getNextCronRunAt } from './cron.ts'
import { computeRetryAt, normalizeRetryPolicy } from './retry.ts'

let DEFAULT_CONCURRENCY = 10
let DEFAULT_POLL_INTERVAL_MS = 1000
let DEFAULT_LEASE_MS = 30000
let DEFAULT_CRON_TICK_MS = 30000

/**
 * Creates a worker loop that claims and executes jobs from a scheduler backend.
 *
 * @param options Worker configuration
 * @returns A `JobWorker` lifecycle controller
 */
export function createJobWorker<defs extends JobDefinitions>(
  options: CreateJobWorkerOptions<defs>,
): JobWorker {
  let scheduler = options.scheduler
  let jobs = options.jobs
  let backend = options.backend
  let workerOptions = normalizeWorkerOptions(options.worker)

  let running = false
  let stopped = false
  let inFlight = new Set<Promise<void>>()
  let jobControllers = new Map<string, AbortController>()

  let loopAbort = new AbortController()
  let workLoopPromise: Promise<void> | undefined
  let cronLoopPromise: Promise<void> | undefined

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
      await backend.upsertSchedules(
        cronSchedules.map((schedule) => toPersistedSchedule(schedule, Date.now())),
      )
      cronLoopPromise = runCronLoop()
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

    await Promise.all([workLoopPromise, cronLoopPromise])
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
        let claimedJobs = await backend.claimDueJobs({
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
      let dueSchedules = await backend.claimDueSchedules({
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

  async function processSchedule(schedule: DueSchedule): Promise<void> {
    let now = Date.now()
    let definition = jobs[schedule.name]

    if (definition == null) {
      await backend.advanceSchedule({
        scheduleId: schedule.id,
        nextRunAt: getNextCronRunAt(schedule.cron, now, schedule.timezone),
        now,
        workerId: workerOptions.workerId,
      })
      return
    }

    let payload = parse(definition.schema, schedule.payload)
    let dispatchCount = getCronDispatchCount(
      schedule.cron,
      schedule.timezone,
      schedule.catchUp,
      schedule.nextRunAt,
      now,
    )
    let dispatchIndex = 0

    while (dispatchIndex < dispatchCount) {
      await scheduler.enqueue(schedule.name as any, payload, {
        queue: schedule.queue,
        retry: schedule.retry,
      })
      dispatchIndex += 1
    }

    let nextRunAt = getNextCronRunAt(schedule.cron, now, schedule.timezone)

    await backend.advanceSchedule({
      scheduleId: schedule.id,
      nextRunAt,
      now,
      workerId: workerOptions.workerId,
    })
  }

  async function processJob(job: JobRecord): Promise<void> {
    let definition = jobs[job.name]

    if (definition == null) {
      await backend.fail({
        jobId: job.id,
        workerId: workerOptions.workerId,
        now: Date.now(),
        error: `Unknown job "${job.name}"`,
        terminal: true,
      })
      return
    }

    let controller = new AbortController()
    jobControllers.set(job.id, controller)

    let heartbeatTimer = setInterval(() => {
      void backend.heartbeat({
        jobId: job.id,
        workerId: workerOptions.workerId,
        leaseMs: workerOptions.leaseMs,
        now: Date.now(),
      })
    }, workerOptions.heartbeatMs)

    try {
      let parsedPayload = parse(definition.schema, job.payload)
      await definition.handle(parsedPayload, {
        signal: controller.signal,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
        queue: job.queue,
        workerId: workerOptions.workerId,
        scheduledAt: job.runAt,
      })

      await backend.complete({
        jobId: job.id,
        workerId: workerOptions.workerId,
        now: Date.now(),
      })
    } catch (error) {
      let now = Date.now()
      let message = normalizeErrorMessage(error)

      if (job.attempts >= job.maxAttempts) {
        await backend.fail({
          jobId: job.id,
          workerId: workerOptions.workerId,
          now,
          error: message,
          terminal: true,
        })
      } else {
        let retryAt = computeRetryAt(now, job.attempts, job.retry)

        await backend.fail({
          jobId: job.id,
          workerId: workerOptions.workerId,
          now,
          error: message,
          retryAt,
          terminal: false,
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

function normalizeWorkerOptions(options?: WorkerOptions): Required<WorkerOptions> {
  let leaseMs = normalizeWholeNumber(options?.leaseMs, DEFAULT_LEASE_MS, 1)

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
  }
}

function toPersistedSchedule<defs extends JobDefinitions>(
  schedule: CronSchedule<defs>,
  now: number,
): PersistedCronSchedule {
  let timeZone = schedule.options.timezone ?? 'UTC'
  let retry = normalizeRetryPolicy(undefined, schedule.options.retry as RetryPolicy | undefined)

  return {
    id: schedule.options.id,
    cron: schedule.cron,
    timezone: timeZone,
    queue: schedule.options.queue ?? 'default',
    name: schedule.name,
    payload: schedule.payload,
    retry,
    catchUp: schedule.options.catchUp ?? 'one',
    nextRunAt: getNextCronRunAt(schedule.cron, now - 60000, timeZone),
  }
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
