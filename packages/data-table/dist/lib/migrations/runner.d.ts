import type { DatabaseAdapter } from '../adapter.ts';
import type { MigrationDescriptor, MigrationRegistry, MigrationRunner, MigrationRunnerOptions } from '../migrations.ts';
/**
 * Creates a migration runner for applying/reverting SQL migrations against an adapter.
 *
 * The `to` option on `up()`/`down()` accepts a bare migration id or the full
 * `id_name` directory form.
 *
 * Runs verify journal integrity first. `up()` rejects when an applied journal
 * entry is missing from the current migration set, while `down()` skips
 * orphaned journal entries so migrations that are still present can be
 * reverted. Checksum drift on matching entries rejects in both directions.
 * @param adapter Database adapter used to execute migration scripts.
 * @param migrations Migration descriptors or registry.
 * @param options Optional runner configuration.
 * @returns A migration runner instance.
 * @example
 * ```ts
 * import { createMigrationRunner } from 'remix/data-table/migrations'
 *
 * let runner = createMigrationRunner(adapter, migrations, {
 *   journalTable: 'app_migrations',
 * })
 * await runner.up()
 * ```
 */
export declare function createMigrationRunner(adapter: DatabaseAdapter, migrations: MigrationDescriptor[] | MigrationRegistry, options?: MigrationRunnerOptions): MigrationRunner;
//# sourceMappingURL=runner.d.ts.map