import type { DatabaseAdapter } from '../adapter.ts';
import type { MigrationDescriptor, MigrationRegistry, MigrationRunner, MigrationRunnerOptions } from '../migrations.ts';
/**
 * Creates a migration runner for applying/reverting SQL migrations against an adapter.
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