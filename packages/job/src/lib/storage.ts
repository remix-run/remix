import type { JobRecord, ResolvedRetryPolicy } from './types.ts'

/**
 * Persisted fields required to enqueue a job in storage.
 */
export interface EnqueueJobInput {
  /**
   * Registered job name.
   */
  name: string

  /**
   * Queue that should own the job.
   */
  queue: string

  /**
   * Parsed payload to persist with the job.
   */
  payload: unknown

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
   * Optional deduplication key.
   */
  dedupeKey?: string

  /**
   * Deduplication TTL in milliseconds.
   */
  dedupeTtlMs?: number

  /**
   * Creation timestamp in milliseconds.
   */
  createdAt: number
}

/**
 * Parameters used when claiming due jobs for a worker.
 */
export interface ClaimDueJobsInput {
  /**
   * Current timestamp in milliseconds.
   */
  now: number

  /**
   * Worker identifier claiming the jobs.
   */
  workerId: string

  /**
   * Queues that the worker is allowed to process.
   */
  queues: string[]

  /**
   * Maximum number of jobs to claim.
   */
  limit: number

  /**
   * Lease duration in milliseconds for claimed jobs.
   */
  leaseMs: number
}

/**
 * Failure payload written after a worker attempt throws.
 */
export interface JobFailureInput {
  /**
   * Identifier of the failed job.
   */
  jobId: string

  /**
   * Worker identifier reporting the failure.
   */
  workerId: string

  /**
   * Current timestamp in milliseconds.
   */
  now: number

  /**
   * Serialized error message to persist.
   */
  error: string

  /**
   * Next retry time in milliseconds when the failure is non-terminal.
   */
  retryAt?: number

  /**
   * Whether the failure is terminal.
   */
  terminal: boolean
}

/**
 * Filters when listing failed jobs from storage.
 */
export interface ListFailedJobsInput {
  /**
   * Optional queue filter.
   */
  queue?: string

  /**
   * Maximum number of failed jobs to return.
   */
  limit?: number
}

/**
 * Parameters for retrying a failed job by enqueuing a new job.
 */
export interface RetryFailedJobInput {
  /**
   * Identifier of the failed source job.
   */
  jobId: string

  /**
   * Optional new run time for the new job.
   */
  runAt?: number

  /**
   * Optional priority override for the new job.
   */
  priority?: number

  /**
   * Optional queue override for the new job.
   */
  queue?: string
}

/**
 * Absolute pruning cutoffs for terminal jobs.
 */
export interface PruneJobsInput {
  /**
   * Delete completed jobs older than this timestamp in milliseconds.
   */
  completedBefore?: number

  /**
   * Delete failed jobs older than this timestamp in milliseconds.
   */
  failedBefore?: number

  /**
   * Delete canceled jobs older than this timestamp in milliseconds.
   */
  canceledBefore?: number

  /**
   * Maximum number of jobs to delete.
   */
  limit: number
}

/**
 * Summary returned from a prune operation.
 */
export interface PruneJobsResult {
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
 * Extra options accepted by storage write operations.
 */
export interface JobWriteOptions<transaction = never> {
  /**
   * Storage-specific transaction handle used for transactional writes.
   */
  transaction?: transaction
}

/**
 * Storage contract for `@remix-run/job` scheduler storage adapters.
 */
export interface JobStorage<transaction = never> {
  /**
   * Persists a new queued job.
   */
  enqueue(
    input: EnqueueJobInput,
    options?: JobWriteOptions<transaction>,
  ): Promise<{ jobId: string; deduped: boolean }>

  /**
   * Reads the persisted state for a job by ID.
   */
  get(jobId: string): Promise<JobRecord | null>

  /**
   * Cancels a queued job before a worker claims it.
   */
  cancel(jobId: string, options?: JobWriteOptions<transaction>): Promise<boolean>

  /**
   * Lists failed jobs, optionally filtered by queue.
   */
  listFailedJobs(input: ListFailedJobsInput): Promise<JobRecord[]>

  /**
   * Retries a failed job into a new queued job while preserving the original failed record.
   */
  retryFailedJob(
    input: RetryFailedJobInput,
    options?: JobWriteOptions<transaction>,
  ): Promise<{ jobId: string } | null>

  /**
   * Deletes terminal jobs that match the supplied absolute cutoffs.
   */
  prune(
    input: PruneJobsInput,
    options?: JobWriteOptions<transaction>,
  ): Promise<PruneJobsResult>

  /**
   * Claims due jobs for a worker and assigns them a lease.
   */
  claimDueJobs(input: ClaimDueJobsInput): Promise<JobRecord[]>

  /**
   * Extends the lease for a claimed running job.
   */
  heartbeat(input: {
    /**
     * Identifier of the claimed job.
     */
    jobId: string

    /**
     * Worker identifier extending the lease.
     */
    workerId: string

    /**
     * Lease duration in milliseconds to extend.
     */
    leaseMs: number

    /**
     * Current timestamp in milliseconds.
     */
    now: number
  }): Promise<boolean>

  /**
   * Marks a claimed job as completed.
   */
  complete(input: {
    /**
     * Identifier of the completed job.
     */
    jobId: string

    /**
     * Worker identifier completing the job.
     */
    workerId: string

    /**
     * Current timestamp in milliseconds.
     */
    now: number
  }): Promise<void>

  /**
   * Records a job failure, optionally scheduling a retry.
   */
  fail(input: JobFailureInput): Promise<void>

}
