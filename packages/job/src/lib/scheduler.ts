import { parse } from '@remix-run/data-schema'

import type {
  CreateJobSchedulerOptions,
  EnqueueOptions,
  Infer,
  JobDefinitions,
  JobRecord,
  JobScheduler,
} from './types.ts'
import { normalizeRetryPolicy } from './retry.ts'

/**
 * Creates a typed map of job handlers.
 *
 * @param jobs Job definitions keyed by name
 * @returns The same job definition object with preserved types
 */
export function createJobs<defs extends JobDefinitions>(jobs: defs): defs {
  return jobs
}

/**
 * Creates a job scheduler backed by a `JobBackend` implementation.
 *
 * @param options Scheduler configuration
 * @returns A `JobScheduler` for enqueuing and querying jobs
 */
export function createJobScheduler<defs extends JobDefinitions>(
  options: CreateJobSchedulerOptions<defs>,
): JobScheduler<defs> {
  let jobs = options.jobs
  let backend = options.backend

  return {
    async enqueue<name extends keyof defs & string>(
      name: name,
      payload: Infer<defs[name]['schema']>,
      enqueueOptions?: EnqueueOptions,
    ): Promise<{ jobId: string; deduped: boolean }> {
      let definition = jobs[name]

      if (definition == null) {
        throw new Error(`Unknown job "${name}"`)
      }

      let parsedPayload = parse(definition.schema, payload)
      let now = Date.now()
      let queue = enqueueOptions?.queue ?? 'default'
      let runAt = resolveRunAt(now, enqueueOptions)
      let priority = normalizeWholeNumber(enqueueOptions?.priority, 0, Number.MIN_SAFE_INTEGER)
      let retry = normalizeRetryPolicy(definition.retry, enqueueOptions?.retry)

      return backend.enqueue({
        name,
        queue,
        payload: parsedPayload,
        runAt,
        priority,
        retry,
        dedupeKey: enqueueOptions?.dedupeKey,
        dedupeTtlMs: enqueueOptions?.dedupeTtlMs,
        createdAt: now,
      })
    },
    get(jobId: string): Promise<JobRecord | null> {
      return backend.get(jobId)
    },
    cancel(jobId: string): Promise<boolean> {
      return backend.cancel(jobId)
    },
  }
}

function resolveRunAt(now: number, options: EnqueueOptions | undefined): number {
  if (options?.runAt != null) {
    return options.runAt.getTime()
  }

  if (options?.delay != null) {
    return now + normalizeWholeNumber(options.delay, 0, 0)
  }

  return now
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
