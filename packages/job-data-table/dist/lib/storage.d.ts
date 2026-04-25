import type { Database } from '@remix-run/data-table';
import type { Migration } from '@remix-run/data-table/migrations';
import type { JobStorage } from '@remix-run/job/storage';
export interface DataTableJobStorageOptions {
    /**
     * Prefix applied to the jobs and dedupe tables. Defaults to `"job_"`.
     */
    tablePrefix?: string;
}
export interface DataTableJobStorageMigrationOptions {
    /**
     * Prefix applied to the jobs and dedupe tables. Defaults to `"job_"`.
     */
    tablePrefix?: string;
}
/**
 * Creates a `JobStorage` implementation using `@remix-run/data-table`.
 *
 * @param db Data-table database handle used to persist job state
 * @param options Optional storage configuration
 * @returns A data-table-backed `JobStorage`
 */
export declare function createDataTableJobStorage(db: Database, options?: DataTableJobStorageOptions): JobStorage<Database>;
/**
 * Creates the built-in migration used to provision `@remix-run/job-data-table` tables.
 *
 * This migration should run before creating a scheduler with `createDataTableJobStorage(...)`.
 *
 * @param options Migration configuration, including the optional table prefix.
 * @returns A data-table migration object that creates/drops storage tables and indexes.
 */
export declare function createDataTableJobStorageMigration(options?: DataTableJobStorageMigrationOptions): Migration;
//# sourceMappingURL=storage.d.ts.map