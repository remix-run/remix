import type { InferOutput, Schema } from '@remix-run/data-schema'

import type { JobStorage } from './storage.ts'

/**
 * Infers the runtime payload type for a data-schema schema.
 */
export type Infer<schema extends Schema<any, any>> = InferOutput<schema>

/**
 * Retry delay algorithm used after a failed attempt.
 */
export type RetryStrategy = 'fixed' | 'exponential'

/**
 * Delay randomization strategy applied to retry backoff.
 */
export type JitterStrategy = 'none' | 'full'

/**
 * Persisted lifecycle state for a job.
 */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled'

/**
 * Configures retry behavior for a job definition or enqueue call.
 */
export interface RetryPolicy {
  /**
   * Maximum number of attempts, including the initial run.
   */
  maxAttempts?: number

  /**
   * Backoff strategy used between retry attempts.
   */
  strategy?: RetryStrategy

  /**
   * Base delay in milliseconds for fixed or exponential retries.
   */
  baseDelayMs?: number

  /**
   * Upper bound in milliseconds for retry delays.
   */
  maxDelayMs?: number

  /**
   * Randomization strategy applied to retry delays.
   */
  jitter?: JitterStrategy
}

/**
 * Fully normalized retry policy stored with persisted jobs.
 */
export interface ResolvedRetryPolicy {
  /**
   * Maximum number of attempts, including the initial run.
   */
  maxAttempts: number

  /**
   * Backoff strategy used between retry attempts.
   */
  strategy: RetryStrategy

  /**
   * Base delay in milliseconds for fixed or exponential retries.
   */
  baseDelayMs: number

  /**
   * Upper bound in milliseconds for retry delays.
   */
  maxDelayMs: number

  /**
   * Randomization strategy applied to retry delays.
   */
  jitter: JitterStrategy
}

type EnqueueOptionsBase<transaction> = {
  /**
   * Queue name to target. Defaults to `"default"`.
   */
  queue?: string

  /**
   * Relative scheduling priority. Higher numbers run first.
   */
  priority?: number

  /**
   * Per-job retry overrides merged with the job definition defaults.
   */
  retry?: RetryPolicy

  /**
   * Deduplication key used to suppress duplicate jobs within a TTL window.
   */
  dedupeKey?: string

  /**
   * Deduplication TTL in milliseconds.
   */
  dedupeTtlMs?: number

  /**
   * Storage-specific transaction handle used for transactional writes.
   */
  transaction?: transaction
}

type EnqueueDelayOptions = {
  /**
   * Delay in milliseconds before the job becomes eligible to run.
   */
  delay?: number
  runAt?: never
}

type EnqueueRunAtOptions = {
  delay?: never

  /**
   * Absolute time when the job becomes eligible to run.
   */
  runAt?: Date
}

/**
 * Options for scheduler writes created with {@link JobScheduler.enqueue}.
 *
 * Pass either `delay` or `runAt`, but never both.
 */
export type EnqueueOptions<transaction = never> = EnqueueOptionsBase<transaction> &
  (EnqueueDelayOptions | EnqueueRunAtOptions)

/**
 * Options for canceling a queued job.
 */
export interface CancelOptions<transaction = never> {
  /**
   * Storage-specific transaction handle used for transactional writes.
   */
  transaction?: transaction
}

/**
 * Filters when listing failed jobs.
 */
export interface FailedJobQueryOptions {
  /**
   * Optional queue name to filter by.
   */
  queue?: string

  /**
   * Maximum number of failed jobs to return. Defaults to `50`.
   */
  limit?: number
}

/**
 * Options for replaying a failed job into a new queued job.
 */
export interface ReplayFailedJobOptions<transaction = never> {
  /**
   * Absolute time when the replayed job should run.
   */
  runAt?: Date

  /**
   * Priority override for the replayed job.
   */
  priority?: number

  /**
   * Queue override for the replayed job.
   */
  queue?: string

  /**
   * Storage-specific transaction handle used for transactional writes.
   */
  transaction?: transaction
}

/**
 * Result returned after replaying a failed job.
 */
export interface ReplayFailedJobResult {
  /**
   * Identifier of the newly enqueued replayed job.
   */
  jobId: string
}

/**
 * Age-based pruning thresholds for terminal jobs.
 */
export interface PrunePolicy {
  /**
   * Delete completed jobs older than this many milliseconds.
   */
  completedOlderThanMs?: number

  /**
   * Delete failed jobs older than this many milliseconds.
   */
  failedOlderThanMs?: number

  /**
   * Delete canceled jobs older than this many milliseconds.
   */
  canceledOlderThanMs?: number
}

/**
 * Options for pruning terminal jobs from storage.
 */
export interface PruneOptions<transaction = never> {
  /**
   * Age-based retention rules applied during pruning.
   */
  policy: PrunePolicy

  /**
   * Maximum number of jobs to delete in one call. Defaults to `500`.
   */
  limit?: number

  /**
   * Storage-specific transaction handle used for transactional writes.
   */
  transaction?: transaction
}

/**
 * Summary of a prune operation.
 */
export interface PruneResult {
  /**
   * Total number of deleted jobs.
   */
  deleted: number

  /**
   * Number of completed jobs deleted.
   */
  completed: number

  /**
   * Number of failed jobs deleted.
   */
  failed: number

  /**
   * Number of canceled jobs deleted.
   */
  canceled: number
}

/**
 * Persisted job state returned by storage and scheduler APIs.
 */
export interface JobRecord {
  /**
   * Unique job identifier.
   */
  id: string

  /**
   * Registered job name.
   */
  name: string

  /**
   * Queue that owns the job.
   */
  queue: string

  /**
   * Parsed job payload.
   */
  payload: unknown

  /**
   * Current persisted job status.
   */
  status: JobStatus

  /**
   * Number of attempts that have started.
   */
  attempts: number

  /**
   * Maximum number of attempts allowed for this job.
   */
  maxAttempts: number

  /**
   * Timestamp in milliseconds when the job becomes eligible to run.
   */
  runAt: number

  /**
   * Relative scheduling priority. Higher numbers run first.
   */
  priority: number

  /**
   * Normalized retry policy stored with the job.
   */
  retry: ResolvedRetryPolicy

  /**
   * Timestamp in milliseconds when the job was created.
   */
  createdAt: number

  /**
   * Timestamp in milliseconds when the job was last updated.
   */
  updatedAt: number

  /**
   * Last error message recorded for the job, if any.
   */
  lastError?: string

  /**
   * Timestamp in milliseconds when the job completed.
   */
  completedAt?: number

  /**
   * Timestamp in milliseconds when the job failed terminally.
   */
  failedAt?: number

  /**
   * Timestamp in milliseconds when the job was canceled.
   */
  canceledAt?: number
}

/**
 * Context passed to a job handler for the current attempt.
 */
export interface JobHandlerContext {
  /**
   * Abort signal that fires when the worker is shutting down or the job lease is lost.
   */
  signal: AbortSignal

  /**
   * One-based attempt number for the current run.
   */
  attempt: number

  /**
   * Maximum number of attempts allowed for this job.
   */
  maxAttempts: number

  /**
   * Queue currently processing the job.
   */
  queue: string

  /**
   * Identifier of the worker processing the job.
   */
  workerId: string

  /**
   * Original `runAt` timestamp in milliseconds for this execution.
   */
  scheduledAt: number
}

/**
 * A single registered job definition.
 */
export interface JobDefinition<payloadSchema extends Schema<any, any>> {
  /**
   * Schema used to validate and parse job payloads.
   */
  schema: payloadSchema

  /**
   * Default retry policy for jobs of this type.
   */
  retry?: RetryPolicy

  /**
   * Async handler invoked by workers when a job is claimed.
   */
  handle(payload: Infer<payloadSchema>, context: JobHandlerContext): Promise<void>
}

/**
 * Map of job names to job definitions.
 */
export type JobDefinitions = Record<string, JobDefinition<Schema<any, any>>>

/**
 * Union of valid job names for a job definition map.
 */
export type JobName<defs extends JobDefinitions> = keyof defs & string

/**
 * Reference to one of the job definitions from a job definition map.
 */
export type JobReference<
  defs extends JobDefinitions,
  name extends JobName<defs> = JobName<defs>,
> = defs[name]

/**
 * Type-safe scheduler input produced from a job definition map.
 */
export type SchedulerEnqueueInput<defs extends JobDefinitions> = {
  [name in JobName<defs>]: {
    /**
     * The referenced job definition object.
     */
    job: JobReference<defs, name>

    /**
     * The inferred job name for the referenced definition.
     */
    jobName: name

    /**
     * Payload type associated with the job schema.
     */
    payload: Infer<defs[name]['schema']>
  }
}[JobName<defs>]

/**
 * Scheduler hook callback names.
 */
export type SchedulerHookName = 'onEnqueue' | 'onCancel' | 'onReplayFailedJob' | 'onPrune'

/**
 * Error event emitted when a scheduler hook throws.
 */
export interface SchedulerHookErrorEvent {
  /**
   * Hook name that threw.
   */
  hook: SchedulerHookName

  /**
   * Original event payload passed to the hook.
   */
  event: unknown

  /**
   * Error thrown by the hook.
   */
  error: unknown
}

/**
 * Event emitted after a scheduler enqueue succeeds.
 */
export type SchedulerEnqueueEvent<
  defs extends JobDefinitions,
  transaction = never,
> = SchedulerEnqueueInput<defs> & {
  /**
   * Options passed to {@link JobScheduler.enqueue}.
   */
  options?: EnqueueOptions<transaction>

  /**
   * Storage result for the enqueue operation.
   */
  result: { jobId: string; deduped: boolean }
}

/**
 * Event emitted after a cancel attempt completes.
 */
export interface SchedulerCancelEvent<transaction = never> {
  /**
   * Identifier of the job that was targeted for cancellation.
   */
  jobId: string

  /**
   * Options passed to {@link JobScheduler.cancel}.
   */
  options?: CancelOptions<transaction>

  /**
   * Whether the queued job was canceled.
   */
  canceled: boolean
}

/**
 * Event emitted after replaying a failed job.
 */
export interface SchedulerReplayFailedJobEvent<transaction = never> {
  /**
   * Identifier of the failed source job.
   */
  jobId: string

  /**
   * Options passed to {@link JobScheduler.replayFailedJob}.
   */
  options?: ReplayFailedJobOptions<transaction>

  /**
   * Result of the replay operation.
   */
  result: ReplayFailedJobResult
}

/**
 * Event emitted after pruning terminal jobs.
 */
export interface SchedulerPruneEvent<transaction = never> {
  /**
   * Options passed to {@link JobScheduler.prune}.
   */
  options: PruneOptions<transaction>

  /**
   * Summary of deleted jobs.
   */
  result: PruneResult
}

/**
 * Fail-open lifecycle hooks for scheduler writes.
 */
export interface SchedulerHooks<defs extends JobDefinitions, transaction = never> {
  /**
   * Runs after a job is enqueued.
   */
  onEnqueue?(event: SchedulerEnqueueEvent<defs, transaction>): void | Promise<void>

  /**
   * Runs after a cancel attempt completes.
   */
  onCancel?(event: SchedulerCancelEvent<transaction>): void | Promise<void>

  /**
   * Runs after a failed job is replayed.
   */
  onReplayFailedJob?(event: SchedulerReplayFailedJobEvent<transaction>): void | Promise<void>

  /**
   * Runs after terminal jobs are pruned.
   */
  onPrune?(event: SchedulerPruneEvent<transaction>): void | Promise<void>

  /**
   * Runs when another scheduler hook throws. Errors from this hook are swallowed.
   */
  onHookError?(event: SchedulerHookErrorEvent): void | Promise<void>
}

/**
 * Worker hook callback names.
 */
export type WorkerHookName =
  | 'onJobStart'
  | 'onJobComplete'
  | 'onJobRetry'
  | 'onJobFailed'
  | 'onPrune'

/**
 * Error event emitted when a worker hook throws.
 */
export interface WorkerHookErrorEvent {
  /**
   * Hook name that threw.
   */
  hook: WorkerHookName

  /**
   * Original event payload passed to the hook.
   */
  event: unknown

  /**
   * Error thrown by the hook.
   */
  error: unknown
}

/**
 * Event emitted when a worker starts processing a job.
 */
export interface WorkerJobStartEvent {
  /**
   * Claimed job record.
   */
  job: JobRecord

  /**
   * Worker identifier that claimed the job.
   */
  workerId: string
}

/**
 * Event emitted when a worker completes a job successfully.
 */
export interface WorkerJobCompleteEvent {
  /**
   * Completed job record.
   */
  job: JobRecord

  /**
   * Worker identifier that processed the job.
   */
  workerId: string

  /**
   * Total execution time in milliseconds for the attempt.
   */
  durationMs: number
}

/**
 * Event emitted when a worker schedules another retry.
 */
export interface WorkerJobRetryEvent {
  /**
   * Failed job record after the retry has been scheduled.
   */
  job: JobRecord

  /**
   * Worker identifier that processed the job.
   */
  workerId: string

  /**
   * Next retry time in milliseconds since epoch.
   */
  retryAt: number

  /**
   * Serialized error message captured for the failure.
   */
  error: string
}

/**
 * Event emitted when a worker marks a job as terminally failed.
 */
export interface WorkerJobFailedEvent {
  /**
   * Failed job record.
   */
  job: JobRecord

  /**
   * Worker identifier that processed the job.
   */
  workerId: string

  /**
   * Serialized error message captured for the failure.
   */
  error: string
}

/**
 * Event emitted when a worker retention pass prunes terminal jobs.
 */
export interface WorkerPruneEvent {
  /**
   * Worker identifier running the prune pass.
   */
  workerId: string

  /**
   * Retention policy used for the prune pass.
   */
  policy: PrunePolicy

  /**
   * Maximum number of jobs eligible for deletion in the pass.
   */
  limit: number

  /**
   * Summary of deleted jobs.
   */
  result: PruneResult
}

/**
 * Fail-open lifecycle hooks for workers.
 */
export interface WorkerHooks {
  /**
   * Runs when a worker starts a job.
   */
  onJobStart?(event: WorkerJobStartEvent): void | Promise<void>

  /**
   * Runs when a worker completes a job successfully.
   */
  onJobComplete?(event: WorkerJobCompleteEvent): void | Promise<void>

  /**
   * Runs when a worker schedules another retry.
   */
  onJobRetry?(event: WorkerJobRetryEvent): void | Promise<void>

  /**
   * Runs when a worker marks a job as terminally failed.
   */
  onJobFailed?(event: WorkerJobFailedEvent): void | Promise<void>

  /**
   * Runs after a worker retention pass prunes jobs.
   */
  onPrune?(event: WorkerPruneEvent): void | Promise<void>

  /**
   * Runs when another worker hook throws. Errors from this hook are swallowed.
   */
  onHookError?(event: WorkerHookErrorEvent): void | Promise<void>
}

/**
 * Type-safe scheduler API returned by `createJobScheduler(...)`.
 */
export interface JobScheduler<defs extends JobDefinitions, transaction = never> {
  /**
   * Enqueues a typed job payload for a registered job definition.
   */
  enqueue<name extends JobName<defs>>(
    job: JobReference<defs, name>,
    payload: Infer<defs[name]['schema']>,
    options?: EnqueueOptions<transaction>,
  ): Promise<{ jobId: string; deduped: boolean }>

  /**
   * Reads the current persisted state for a job.
   */
  get(jobId: string): Promise<JobRecord | null>

  /**
   * Cancels a queued job before a worker claims it.
   */
  cancel(jobId: string, options?: CancelOptions<transaction>): Promise<boolean>

  /**
   * Lists recently failed jobs, optionally filtered by queue.
   */
  listFailedJobs(options?: FailedJobQueryOptions): Promise<JobRecord[]>

  /**
   * Replays a failed job by inserting a new queued job and preserving the original failed record.
   */
  replayFailedJob(
    jobId: string,
    options?: ReplayFailedJobOptions<transaction>,
  ): Promise<ReplayFailedJobResult>

  /**
   * Deletes terminal jobs that match a retention policy.
   */
  prune(options: PruneOptions<transaction>): Promise<PruneResult>
}

/**
 * Configuration for worker-driven automatic pruning.
 */
export interface WorkerRetentionOptions {
  /**
   * Age thresholds that decide which terminal jobs are deleted.
   */
  policy: PrunePolicy

  /**
   * Delay between retention passes in milliseconds. Defaults to `60000`.
   */
  intervalMs?: number

  /**
   * Maximum number of jobs to delete per retention pass. Defaults to `500`.
   */
  limit?: number
}

/**
 * Runtime settings for a worker instance.
 */
export interface WorkerOptions {
  /**
   * Stable identifier for this worker instance. A random UUID is used by default.
   */
  workerId?: string

  /**
   * Queues that this worker is allowed to process. Defaults to `["default"]`.
   */
  queues?: string[]

  /**
   * Maximum number of jobs processed concurrently. Defaults to `10`.
   */
  concurrency?: number

  /**
   * Delay in milliseconds between polling attempts for due jobs. Defaults to `1000`.
   */
  pollIntervalMs?: number

  /**
   * Lease duration in milliseconds for claimed jobs. Defaults to `30000`.
   */
  leaseMs?: number

  /**
   * Interval in milliseconds between job heartbeats. Defaults to half the lease duration.
   */
  heartbeatMs?: number

  /**
   * Optional background retention loop configuration.
   */
  retention?: WorkerRetentionOptions
}

/**
 * Lifecycle controls for a running worker instance.
 */
export interface JobWorker {
  /**
   * Starts polling for jobs.
   */
  start(): Promise<void>

  /**
   * Stops the worker and aborts in-flight work.
   */
  stop(): Promise<void>

  /**
   * Waits for in-flight jobs to finish without accepting new work.
   */
  drain(timeoutMs?: number): Promise<void>
}

/**
 * Options for constructing a worker.
 */
export type CreateJobWorkerOptions<defs extends JobDefinitions> = {
  /**
   * Registered job definitions keyed by name.
   */
  jobs: defs

  /**
   * Storage adapter used to claim, run, and mutate jobs.
   */
  storage: JobStorage

  /**
   * Worker runtime settings.
   */
  worker?: WorkerOptions
} & WorkerHooks
