import type { InferOutput, Schema } from '@remix-run/data-schema'

import type { JobBackend } from './backend.ts'

export type Infer<schema extends Schema<any, any>> = InferOutput<schema>

export type RetryStrategy = 'fixed' | 'exponential'

export type JitterStrategy = 'none' | 'full'

export type CatchUpPolicy = 'none' | 'one' | 'all'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'

export interface RetryPolicy {
  maxAttempts?: number
  strategy?: RetryStrategy
  baseDelayMs?: number
  maxDelayMs?: number
  jitter?: JitterStrategy
}

export interface ResolvedRetryPolicy {
  maxAttempts: number
  strategy: RetryStrategy
  baseDelayMs: number
  maxDelayMs: number
  jitter: JitterStrategy
}

export interface EnqueueOptions {
  queue?: string
  delay?: number
  runAt?: Date
  priority?: number
  retry?: RetryPolicy
  dedupeKey?: string
  dedupeTtlMs?: number
}

export interface CronScheduleOptions {
  id: string
  queue?: string
  timezone?: string
  retry?: RetryPolicy
  catchUp?: CatchUpPolicy
}

export interface JobRecord {
  id: string
  name: string
  queue: string
  payload: unknown
  status: JobStatus
  attempts: number
  maxAttempts: number
  runAt: number
  priority: number
  retry: ResolvedRetryPolicy
  createdAt: number
  updatedAt: number
  lastError?: string
}

export interface JobHandlerContext {
  signal: AbortSignal
  attempt: number
  maxAttempts: number
  queue: string
  workerId: string
  scheduledAt: number
}

export interface JobDefinition<payloadSchema extends Schema<any, any>> {
  schema: payloadSchema
  retry?: RetryPolicy
  handle(payload: Infer<payloadSchema>, context: JobHandlerContext): Promise<void>
}

export type JobDefinitions = Record<string, JobDefinition<Schema<any, any>>>
export type JobName<defs extends JobDefinitions> = keyof defs & string
export type JobReference<
  defs extends JobDefinitions,
  name extends JobName<defs> = JobName<defs>,
> = defs[name]

export type CronSchedule<
  defs extends JobDefinitions,
  name extends JobName<defs> = JobName<defs>,
> = {
  schedule: string
  job: JobReference<defs, name>
  payload: Infer<defs[name]['schema']>
  options: CronScheduleOptions
}

export interface JobScheduler<defs extends JobDefinitions> {
  enqueue<name extends JobName<defs>>(
    job: JobReference<defs, name>,
    payload: Infer<defs[name]['schema']>,
    options?: EnqueueOptions,
  ): Promise<{ jobId: string; deduped: boolean }>
  get(jobId: string): Promise<JobRecord | null>
  cancel(jobId: string): Promise<boolean>
}

export interface WorkerOptions {
  workerId?: string
  queues?: string[]
  concurrency?: number
  pollIntervalMs?: number
  leaseMs?: number
  heartbeatMs?: number
  cronTickMs?: number
}

export interface JobWorker {
  start(): Promise<void>
  stop(): Promise<void>
  drain(timeoutMs?: number): Promise<void>
}

export interface CreateJobSchedulerOptions<defs extends JobDefinitions> {
  jobs: defs
  backend: JobBackend
}

export interface CreateJobWorkerOptions<defs extends JobDefinitions> {
  scheduler: JobScheduler<defs>
  jobs: defs
  backend: JobBackend
  worker?: WorkerOptions
  cron?: Array<CronSchedule<defs>>
}
