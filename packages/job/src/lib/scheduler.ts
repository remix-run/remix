import { parse } from '@remix-run/data-schema'

import type {
  CreateJobSchedulerOptions,
  EnqueueOptions,
  Infer,
  JobDefinitions,
  JobName,
  JobReference,
  JobRecord,
  JobScheduler,
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
export function createJobScheduler<defs extends JobDefinitions>(
  options: CreateJobSchedulerOptions<defs>,
): JobScheduler<defs> {
  let jobs = options.jobs
  let storage = options.storage
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
      enqueueOptions?: EnqueueOptions,
    ): Promise<{ jobId: string; deduped: boolean }> {
      let name = resolveJobName(job, jobNames)
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

      return storage.enqueue({
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
      return storage.get(jobId)
    },
    cancel(jobId: string): Promise<boolean> {
      return storage.cancel(jobId)
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
