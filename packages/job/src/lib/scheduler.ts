import { parse } from '@remix-run/data-schema'

import type {
  CancelOptions,
  CreateJobSchedulerOptions,
  DeadLetterQueryOptions,
  EnqueueOptions,
  Infer,
  JobDefinitions,
  JobName,
  JobReference,
  JobRecord,
  JobScheduler,
  PruneOptions,
  PruneResult,
  ReplayDeadLetterOptions,
  ReplayDeadLetterResult,
  SchedulerHookName,
  SchedulerHooks,
} from './types.ts'
import { normalizeRetryPolicy } from './retry.ts'

/**
 * Creates a typed map of job handlers.
 *
 * @param jobs Job definitions keyed by name
 * @returns The same job definition object with preserved key/schema types
 */
export function createJobs<defs extends JobDefinitions>(jobs: defs): defs {
  return jobs
}

/**
 * Creates a job scheduler backed by a `JobStorage` implementation.
 *
 * @param options Scheduler configuration
 * @returns A `JobScheduler` for enqueuing and querying jobs
 */
export function createJobScheduler<
  defs extends JobDefinitions,
  transaction = never,
>(
  options: CreateJobSchedulerOptions<defs, transaction>,
): JobScheduler<defs, transaction> {
  let jobs = options.jobs
  let storage = options.storage
  let hooks = options.hooks
  let jobNames = new WeakMap<object, string>()

  for (let name in jobs) {
    let definition = jobs[name]

    if (definition != null && typeof definition === 'object') {
      jobNames.set(definition, name)
    }
  }

  return {
    async enqueue<name extends JobName<defs>>(
      job: JobReference<defs, name>,
      payload: Infer<defs[name]['schema']>,
      enqueueOptions?: EnqueueOptions<transaction>,
    ): Promise<{ jobId: string; deduped: boolean }> {
      let jobName = resolveJobName(job, jobNames) as name
      let definition = jobs[jobName]

      if (definition == null) {
        throw new Error(`Unknown job "${jobName}"`)
      }

      let parsedPayload = parse(definition.schema, payload)
      let now = Date.now()
      let queue = enqueueOptions?.queue ?? 'default'
      let runAt = resolveRunAt(now, enqueueOptions)
      let priority = normalizeWholeNumber(enqueueOptions?.priority, 0, Number.MIN_SAFE_INTEGER)
      let retry = normalizeRetryPolicy(definition.retry, enqueueOptions?.retry)

      let result = await storage.enqueue({
        name: jobName,
        queue,
        payload: parsedPayload,
        runAt,
        priority,
        retry,
        dedupeKey: enqueueOptions?.dedupeKey,
        dedupeTtlMs: enqueueOptions?.dedupeTtlMs,
        createdAt: now,
      }, {
        transaction: enqueueOptions?.transaction,
      })

      await runSchedulerHook(hooks, 'onEnqueue', {
        job,
        jobName,
        payload: parsedPayload,
        options: enqueueOptions,
        result,
      })

      return result
    },
    get(jobId: string): Promise<JobRecord | null> {
      return storage.get(jobId)
    },
    async cancel(jobId: string, cancelOptions?: CancelOptions<transaction>): Promise<boolean> {
      let canceled = await storage.cancel(jobId, {
        transaction: cancelOptions?.transaction,
      })

      await runSchedulerHook(hooks, 'onCancel', {
        jobId,
        options: cancelOptions,
        canceled,
      })

      return canceled
    },
    listDeadLetters(deadLetterOptions?: DeadLetterQueryOptions): Promise<JobRecord[]> {
      return storage.listDeadLetters({
        queue: deadLetterOptions?.queue,
        limit: normalizeOptionalWholeNumber(deadLetterOptions?.limit, 50, 1),
      })
    },
    async replayDeadLetter(
      jobId: string,
      replayOptions?: ReplayDeadLetterOptions<transaction>,
    ): Promise<ReplayDeadLetterResult> {
      let replayed = await storage.replayDeadLetter(
        {
          jobId,
          runAt: replayOptions?.runAt?.getTime(),
          priority:
            replayOptions?.priority == null
              ? undefined
              : normalizeWholeNumber(replayOptions.priority, 0, Number.MIN_SAFE_INTEGER),
          queue: replayOptions?.queue,
        },
        {
          transaction: replayOptions?.transaction,
        },
      )

      if (replayed == null) {
        throw new Error(`Cannot replay job "${jobId}": job not found or not failed`)
      }

      let result = {
        jobId: replayed.jobId,
      }

      await runSchedulerHook(hooks, 'onReplayDeadLetter', {
        jobId,
        options: replayOptions,
        result,
      })

      return result
    },
    async prune(pruneOptions: PruneOptions<transaction>): Promise<PruneResult> {
      let now = Date.now()
      let result = await storage.prune(
        {
          completedBefore: resolvePruneCutoff(now, pruneOptions.policy.completedOlderThanMs),
          failedBefore: resolvePruneCutoff(now, pruneOptions.policy.failedOlderThanMs),
          canceledBefore: resolvePruneCutoff(now, pruneOptions.policy.canceledOlderThanMs),
          limit: normalizeWholeNumber(pruneOptions.limit, 500, 1),
        },
        {
          transaction: pruneOptions.transaction,
        },
      )

      await runSchedulerHook(hooks, 'onPrune', {
        options: pruneOptions,
        result,
      })

      return result
    },
  }
}

function resolveJobName(
  value: object,
  names: WeakMap<object, string>,
): string {
  let name = names.get(value)

  if (name == null) {
    throw new Error('Unknown job definition passed to enqueue()')
  }

  return name
}

function resolveRunAt<transaction>(
  now: number,
  options: EnqueueOptions<transaction> | undefined,
): number {
  if (options?.runAt != null) {
    return options.runAt.getTime()
  }

  if (options?.delay != null) {
    return now + normalizeWholeNumber(options.delay, 0, 0)
  }

  return now
}

function resolvePruneCutoff(now: number, olderThanMs: number | undefined): number | undefined {
  if (olderThanMs == null) {
    return undefined
  }

  return now - normalizeWholeNumber(olderThanMs, 0, 0)
}

function normalizeOptionalWholeNumber(
  value: unknown,
  fallback: number,
  minValue: number,
): number | undefined {
  if (value == null) {
    return undefined
  }

  return normalizeWholeNumber(value, fallback, minValue)
}

async function runSchedulerHook<
  defs extends JobDefinitions,
  transaction,
>(
  hooks: SchedulerHooks<defs, transaction> | undefined,
  hook: SchedulerHookName,
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
