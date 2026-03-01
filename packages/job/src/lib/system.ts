import type {
  CreateJobSystemOptions,
  JobDefinitions,
  JobSystem,
  JobSystemWorkerOptions,
  JobWorker,
} from './types.ts'
import { createJobScheduler } from './scheduler.ts'
import { createJobWorker } from './worker.ts'

/**
 * Creates a cohesive job system with a shared scheduler and worker factory.
 *
 * @param options System configuration with jobs, storage, and scheduler hooks
 * @returns A `JobSystem` with a scheduler and `createWorker(...)`
 */
export function createJobSystem<
  defs extends JobDefinitions,
  transaction = never,
>(
  options: CreateJobSystemOptions<defs, transaction>,
): JobSystem<defs, transaction> {
  let jobs = options.jobs
  let storage = options.storage
  let scheduler = createJobScheduler(options)

  return {
    scheduler,
    createWorker(workerOptions?: JobSystemWorkerOptions<defs>): JobWorker {
      let resolvedOptions: JobSystemWorkerOptions<defs> = workerOptions ?? {}

      return createJobWorker({
        jobs,
        storage,
        ...resolvedOptions,
      })
    },
  }
}
