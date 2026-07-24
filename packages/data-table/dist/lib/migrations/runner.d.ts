import type { DatabaseAdapter } from '../adapter.ts';
import type { MigrationOperationOptions, MigrateResult, MigrationDescriptor, MigrationRegistry, MigrationStatusEntry } from '../migrations.ts';
interface MigrationRunnerOptions {
    journalTable?: string;
}
interface MigrationRunner {
    up(options?: MigrationOperationOptions): Promise<MigrateResult>;
    down(options?: MigrationOperationOptions): Promise<MigrateResult>;
    status(): Promise<MigrationStatusEntry[]>;
}
export declare function createMigrationRunner(adapter: DatabaseAdapter, migrations: MigrationDescriptor[] | MigrationRegistry, options?: MigrationRunnerOptions): MigrationRunner;
export {};
//# sourceMappingURL=runner.d.ts.map