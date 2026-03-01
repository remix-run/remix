import type {
  ClaimDueJobsInput,
  ClaimDueSchedulesInput,
  DueSchedule,
  EnqueueJobInput,
  JobStorage,
  JobWriteOptions,
  JobFailureInput,
  PersistedCronSchedule,
} from '../storage.ts'
import type { JobRecord } from '../types.ts'

/**
 * In-memory storage used for unit and contract tests.
 *
 * @returns A `JobStorage` implementation that stores state in memory
 */
export function createMemoryJobStorage(): JobStorage {
  let jobs = new Map<string, JobRecord & { lockedBy?: string; lockedUntil?: number }>()
  let dedupe = new Map<string, { jobId: string; expiresAt: number }>()
  let schedules = new Map<string, PersistedCronSchedule & { lockedBy?: string; lockedUntil?: number }>()

  return {
    async enqueue(
      input: EnqueueJobInput,
      _options?: JobWriteOptions,
    ): Promise<{ jobId: string; deduped: boolean }> {
      cleanupDedupe(Date.now())

      if (input.dedupeKey != null) {
        let existing = dedupe.get(input.dedupeKey)

        if (existing != null && existing.expiresAt > input.createdAt) {
          return {
            jobId: existing.jobId,
            deduped: true,
          }
        }
      }

      let jobId = crypto.randomUUID()

      jobs.set(jobId, {
        id: jobId,
        name: input.name,
        queue: input.queue,
        payload: input.payload,
        status: 'queued',
        attempts: 0,
        maxAttempts: input.retry.maxAttempts,
        runAt: input.runAt,
        priority: input.priority,
        retry: input.retry,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })

      if (input.dedupeKey != null && input.dedupeTtlMs != null && input.dedupeTtlMs > 0) {
        dedupe.set(input.dedupeKey, {
          jobId,
          expiresAt: input.createdAt + input.dedupeTtlMs,
        })
      }

      return {
        jobId,
        deduped: false,
      }
    },
    async get(jobId: string): Promise<JobRecord | null> {
      let job = jobs.get(jobId)
      return job == null ? null : toPublicJob(job)
    },
    async cancel(jobId: string, _options?: JobWriteOptions): Promise<boolean> {
      let job = jobs.get(jobId)

      if (job == null || job.status !== 'queued') {
        return false
      }

      job.status = 'canceled'
      job.updatedAt = Date.now()
      jobs.set(jobId, job)

      return true
    },
    async claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]> {
      cleanupDedupe(input.now)

      let claimed: JobRecord[] = []
      let candidates = Array.from(jobs.values())
        .filter((job) => {
          if (job.status !== 'queued' && job.status !== 'running') {
            return false
          }

          if (job.runAt > input.now) {
            return false
          }

          if (!input.queues.includes(job.queue)) {
            return false
          }

          if (job.status === 'running') {
            return job.lockedUntil != null && job.lockedUntil <= input.now
          }

          return true
        })
        .sort(sortJobs)

      for (let job of candidates) {
        if (claimed.length >= input.limit) {
          break
        }

        let lockedUntil = input.now + input.leaseMs
        job.status = 'running'
        job.lockedBy = input.workerId
        job.lockedUntil = lockedUntil
        job.attempts += 1
        job.updatedAt = input.now
        jobs.set(job.id, job)

        claimed.push(toPublicJob(job))
      }

      return claimed
    },
    async heartbeat(input: {
      jobId: string
      workerId: string
      leaseMs: number
      now: number
    }): Promise<boolean> {
      let job = jobs.get(input.jobId)

      if (
        job == null ||
        job.status !== 'running' ||
        job.lockedBy !== input.workerId ||
        (job.lockedUntil != null && job.lockedUntil <= input.now)
      ) {
        return false
      }

      job.lockedUntil = input.now + input.leaseMs
      job.updatedAt = input.now
      jobs.set(job.id, job)

      return true
    },
    async complete(input: { jobId: string; workerId: string; now: number }): Promise<void> {
      let job = jobs.get(input.jobId)

      if (job == null || job.status !== 'running' || job.lockedBy !== input.workerId) {
        return
      }

      job.status = 'completed'
      job.lockedBy = undefined
      job.lockedUntil = undefined
      job.updatedAt = input.now
      jobs.set(job.id, job)
    },
    async fail(input: JobFailureInput): Promise<void> {
      let job = jobs.get(input.jobId)

      if (job == null || job.status !== 'running' || job.lockedBy !== input.workerId) {
        return
      }

      if (input.terminal) {
        job.status = 'failed'
      } else {
        job.status = 'queued'
        job.runAt = input.retryAt ?? input.now
      }

      job.lockedBy = undefined
      job.lockedUntil = undefined
      job.lastError = input.error
      job.updatedAt = input.now
      jobs.set(job.id, job)
    },
    async upsertSchedules(input: PersistedCronSchedule[]): Promise<void> {
      for (let schedule of input) {
        let current = schedules.get(schedule.id)

        schedules.set(schedule.id, {
          ...schedule,
          nextRunAt: current?.nextRunAt ?? schedule.nextRunAt,
          lockedBy: undefined,
          lockedUntil: undefined,
        })
      }
    },
    async claimDueSchedules(input: ClaimDueSchedulesInput): Promise<DueSchedule[]> {
      let due: DueSchedule[] = []
      let candidates = Array.from(schedules.values())
        .filter((schedule) => {
          if (schedule.nextRunAt > input.now) {
            return false
          }

          return schedule.lockedUntil == null || schedule.lockedUntil <= input.now
        })
        .sort((a, b) => a.nextRunAt - b.nextRunAt)

      for (let schedule of candidates) {
        if (due.length >= input.limit) {
          break
        }

        schedule.lockedBy = input.workerId
        schedule.lockedUntil = input.now + input.leaseMs

        schedules.set(schedule.id, schedule)

        due.push({
          ...schedule,
          lockedBy: input.workerId,
          lockedUntil: schedule.lockedUntil,
        })
      }

      return due
    },
    async advanceSchedule(input: {
      scheduleId: string
      nextRunAt: number
      now: number
      workerId: string
    }): Promise<void> {
      let schedule = schedules.get(input.scheduleId)

      if (schedule == null || schedule.lockedBy !== input.workerId) {
        return
      }

      schedule.nextRunAt = input.nextRunAt
      schedule.lockedBy = undefined
      schedule.lockedUntil = undefined

      schedules.set(schedule.id, schedule)
    },
  }

  function cleanupDedupe(now: number): void {
    for (let [key, value] of dedupe.entries()) {
      if (value.expiresAt <= now) {
        dedupe.delete(key)
      }
    }
  }
}

function toPublicJob(job: JobRecord & { lockedBy?: string; lockedUntil?: number }): JobRecord {
  return {
    id: job.id,
    name: job.name,
    queue: job.queue,
    payload: job.payload,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAt: job.runAt,
    priority: job.priority,
    retry: job.retry,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastError: job.lastError,
  }
}

function sortJobs(a: JobRecord, b: JobRecord): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority
  }

  if (a.runAt !== b.runAt) {
    return a.runAt - b.runAt
  }

  return a.createdAt - b.createdAt
}
