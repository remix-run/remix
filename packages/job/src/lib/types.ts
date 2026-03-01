import type { InferOutput, Schema } from '@remix-run/data-schema'

import type { JobStorage } from './storage.ts'

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

type EnqueueOptionsBase<transaction> = {
  queue?: string
  priority?: number
  retry?: RetryPolicy
  dedupeKey?: string
  dedupeTtlMs?: number
  transaction?: transaction
}

type EnqueueDelayOptions = {
  delay?: number
  runAt?: never
}

type EnqueueRunAtOptions = {
  delay?: never
  runAt?: Date
}

export type EnqueueOptions<transaction = never> = EnqueueOptionsBase<transaction> &
  (EnqueueDelayOptions | EnqueueRunAtOptions)

export interface CancelOptions<transaction = never> {
  transaction?: transaction
}

export interface FailedJobQueryOptions {
  queue?: string
  limit?: number
}

export interface ReplayFailedJobOptions<transaction = never> {
  runAt?: Date
  priority?: number
  queue?: string
  transaction?: transaction
}

export interface ReplayFailedJobResult {
  jobId: string
}

export interface PrunePolicy {
  completedOlderThanMs?: number
  failedOlderThanMs?: number
  canceledOlderThanMs?: number
}

export interface PruneOptions<transaction = never> {
  policy: PrunePolicy
  limit?: number
  transaction?: transaction
}

export interface PruneResult {
  deleted: number
  completed: number
  failed: number
  canceled: number
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
  completedAt?: number
  failedAt?: number
  canceledAt?: number
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

export type SchedulerEnqueueInput<defs extends JobDefinitions> = {
  [name in JobName<defs>]: {
    job: JobReference<defs, name>
    jobName: name
    payload: Infer<defs[name]['schema']>
  }
}[JobName<defs>]

export type CronSchedule<
  defs extends JobDefinitions,
  name extends JobName<defs> = JobName<defs>,
> = {
  schedule: string
  job: JobReference<defs, name>
  payload: Infer<defs[name]['schema']>
  options: CronScheduleOptions
}

export type SchedulerHookName = 'onEnqueue' | 'onCancel' | 'onReplayFailedJob' | 'onPrune'

export interface SchedulerHookErrorEvent {
  hook: SchedulerHookName
  event: unknown
  error: unknown
}

export type SchedulerEnqueueEvent<
  defs extends JobDefinitions,
  transaction = never,
> = SchedulerEnqueueInput<defs> & {
  options?: EnqueueOptions<transaction>
  result: { jobId: string; deduped: boolean }
}

export interface SchedulerCancelEvent<transaction = never> {
  jobId: string
  options?: CancelOptions<transaction>
  canceled: boolean
}

export interface SchedulerReplayFailedJobEvent<transaction = never> {
  jobId: string
  options?: ReplayFailedJobOptions<transaction>
  result: ReplayFailedJobResult
}

export interface SchedulerPruneEvent<transaction = never> {
  options: PruneOptions<transaction>
  result: PruneResult
}

export interface SchedulerHooks<defs extends JobDefinitions, transaction = never> {
  onEnqueue?(event: SchedulerEnqueueEvent<defs, transaction>): void | Promise<void>
  onCancel?(event: SchedulerCancelEvent<transaction>): void | Promise<void>
  onReplayFailedJob?(event: SchedulerReplayFailedJobEvent<transaction>): void | Promise<void>
  onPrune?(event: SchedulerPruneEvent<transaction>): void | Promise<void>
  onHookError?(event: SchedulerHookErrorEvent): void | Promise<void>
}

export type WorkerHookName =
  | 'onJobStart'
  | 'onJobComplete'
  | 'onJobRetry'
  | 'onJobFailed'
  | 'onPrune'

export interface WorkerHookErrorEvent {
  hook: WorkerHookName
  event: unknown
  error: unknown
}

export interface WorkerJobStartEvent {
  job: JobRecord
  workerId: string
}

export interface WorkerJobCompleteEvent {
  job: JobRecord
  workerId: string
  durationMs: number
}

export interface WorkerJobRetryEvent {
  job: JobRecord
  workerId: string
  retryAt: number
  error: string
}

export interface WorkerJobFailedEvent {
  job: JobRecord
  workerId: string
  error: string
}

export interface WorkerPruneEvent {
  workerId: string
  policy: PrunePolicy
  limit: number
  result: PruneResult
}

export interface WorkerHooks {
  onJobStart?(event: WorkerJobStartEvent): void | Promise<void>
  onJobComplete?(event: WorkerJobCompleteEvent): void | Promise<void>
  onJobRetry?(event: WorkerJobRetryEvent): void | Promise<void>
  onJobFailed?(event: WorkerJobFailedEvent): void | Promise<void>
  onPrune?(event: WorkerPruneEvent): void | Promise<void>
  onHookError?(event: WorkerHookErrorEvent): void | Promise<void>
}

export interface JobScheduler<defs extends JobDefinitions, transaction = never> {
  enqueue<name extends JobName<defs>>(
    job: JobReference<defs, name>,
    payload: Infer<defs[name]['schema']>,
    options?: EnqueueOptions<transaction>,
  ): Promise<{ jobId: string; deduped: boolean }>
  get(jobId: string): Promise<JobRecord | null>
  cancel(jobId: string, options?: CancelOptions<transaction>): Promise<boolean>
  listFailedJobs(options?: FailedJobQueryOptions): Promise<JobRecord[]>
  replayFailedJob(
    jobId: string,
    options?: ReplayFailedJobOptions<transaction>,
  ): Promise<ReplayFailedJobResult>
  prune(options: PruneOptions<transaction>): Promise<PruneResult>
}

export interface WorkerRetentionOptions {
  policy: PrunePolicy
  intervalMs?: number
  limit?: number
}

export interface WorkerOptions {
  workerId?: string
  queues?: string[]
  concurrency?: number
  pollIntervalMs?: number
  leaseMs?: number
  heartbeatMs?: number
  cronTickMs?: number
  retention?: WorkerRetentionOptions
}

export interface JobWorker {
  start(): Promise<void>
  stop(): Promise<void>
  drain(timeoutMs?: number): Promise<void>
}

export type CreateJobSchedulerOptions<
  defs extends JobDefinitions,
  transaction = never,
> = {
  jobs: defs
  storage: JobStorage<transaction>
} & SchedulerHooks<defs, transaction>

export type CreateJobWorkerOptions<defs extends JobDefinitions> = {
  jobs: defs
  storage: JobStorage
  worker?: WorkerOptions
  cron?: Array<CronSchedule<defs>>
} & WorkerHooks
