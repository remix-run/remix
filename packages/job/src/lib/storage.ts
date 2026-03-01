import type { CatchUpPolicy, JobRecord, ResolvedRetryPolicy } from './types.ts'

export interface EnqueueJobInput {
  name: string
  queue: string
  payload: unknown
  runAt: number
  priority: number
  retry: ResolvedRetryPolicy
  dedupeKey?: string
  dedupeTtlMs?: number
  createdAt: number
}

export interface ClaimDueJobsInput {
  now: number
  workerId: string
  queues: string[]
  limit: number
  leaseMs: number
}

export interface JobFailureInput {
  jobId: string
  workerId: string
  now: number
  error: string
  retryAt?: number
  terminal: boolean
}

export interface PersistedCronSchedule {
  id: string
  cron: string
  timezone: string
  queue: string
  name: string
  payload: unknown
  retry: ResolvedRetryPolicy
  catchUp: CatchUpPolicy
  nextRunAt: number
}

export interface ClaimDueSchedulesInput {
  now: number
  workerId: string
  leaseMs: number
  limit: number
}

export interface DueSchedule extends PersistedCronSchedule {
  lockedBy: string
  lockedUntil: number
}

/**
 * Storage contract for `@remix-run/job` scheduler storage adapters.
 */
export interface JobStorage {
  enqueue(input: EnqueueJobInput): Promise<{ jobId: string; deduped: boolean }>
  get(jobId: string): Promise<JobRecord | null>
  cancel(jobId: string): Promise<boolean>
  claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]>
  heartbeat(input: { jobId: string; workerId: string; leaseMs: number; now: number }): Promise<boolean>
  complete(input: { jobId: string; workerId: string; now: number }): Promise<void>
  fail(input: JobFailureInput): Promise<void>
  upsertSchedules(input: PersistedCronSchedule[]): Promise<void>
  claimDueSchedules(input: ClaimDueSchedulesInput): Promise<DueSchedule[]>
  advanceSchedule(input: {
    scheduleId: string
    nextRunAt: number
    now: number
    workerId: string
  }): Promise<void>
}
