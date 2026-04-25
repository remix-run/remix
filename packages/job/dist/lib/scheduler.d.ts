import type { JobDefinitions, JobScheduler, SchedulerHooks } from './types.ts';
import type { JobStorage } from './storage.ts';
/**
 * Creates a typed map of job handlers.
 *
 * @param jobs Job definitions keyed by name
 * @returns The same job definition object with preserved key/schema types
 */
export declare function createJobs<defs extends JobDefinitions>(jobs: defs): defs;
/**
 * Creates a job scheduler backed by a `JobStorage` implementation.
 *
 * @param jobs Registered job definitions keyed by name
 * @param storage Storage adapter used for scheduler reads and writes
 * @param hooks Optional scheduler lifecycle hooks
 * @returns A `JobScheduler` for enqueuing and querying jobs
 */
export declare function createJobScheduler<defs extends JobDefinitions, transaction = never>(jobs: defs, storage: JobStorage<transaction>, hooks?: SchedulerHooks<defs, transaction>): JobScheduler<defs, transaction>;
//# sourceMappingURL=scheduler.d.ts.map