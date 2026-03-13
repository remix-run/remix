import type { CreateJobWorkerOptions, JobDefinitions, JobWorker } from './types.ts';
import type { JobStorage } from './storage.ts';
/**
 * Creates a worker loop that claims and executes jobs from storage.
 *
 * @param jobs Registered job definitions keyed by name
 * @param storage Storage adapter used to claim, run, and mutate jobs
 * @param options Optional worker settings and hooks
 * @returns A `JobWorker` lifecycle controller
 */
export declare function createJobWorker<defs extends JobDefinitions>(jobs: defs, storage: JobStorage, options?: CreateJobWorkerOptions): JobWorker;
//# sourceMappingURL=worker.d.ts.map