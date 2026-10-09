import type { Database } from './lib/database.ts';
import type { Migrations, Seed } from './lib/migrations.ts';
interface DatabaseCommandOptions {
    /** Database instance used by the command. */
    db: Database;
}
type RollbackBoundOptions = {
    /**
     * Reverts back through this migration, inclusive. Accepts a bare
     * migration id or the full `id_name` directory form.
     */
    to: string;
    step?: never;
} | {
    to?: never;
    /** Reverts this many migrations. Defaults to `1`. */
    step?: number;
};
type RollbackCommandOptions = DatabaseCommandOptions & RollbackBoundOptions & {
    /** Reverts applied migrations, newest first. */
    command: 'rollback';
    /** Migrations to revert. */
    migrations: Migrations;
    /** Reports what would be reverted without running it. */
    dryRun?: boolean;
    /** Migration journal table. */
    journalTable?: string;
};
/** Structured invocation options accepted by {@link runRemixDb}. */
export type RunRemixDbOptions = (DatabaseCommandOptions & {
    /** Applies pending migrations. */
    command: 'migrate';
    /** Migrations to apply. */
    migrations: Migrations;
    /**
     * Stops after applying this migration. Accepts a bare migration id or
     * the full `id_name` directory form.
     */
    to?: string;
    /** Migration journal table. */
    journalTable?: string;
}) | RollbackCommandOptions | (DatabaseCommandOptions & {
    /** Wipes, migrates, and optionally seeds the database. */
    command: 'reset';
    /** Migrations to apply after wiping the database. */
    migrations: Migrations;
    /** Initializes database data after migrations finish. */
    seed?: Seed;
    /** Migration journal table. */
    journalTable?: string;
}) | (DatabaseCommandOptions & {
    /** Runs the application's seed function. */
    command: 'seed';
    /** Initializes application database data. */
    seed: Seed;
}) | (DatabaseCommandOptions & {
    /** Reports the status of known migrations. */
    command: 'status';
    /** Migrations to inspect. */
    migrations: Migrations;
    /** Migration journal table. */
    journalTable?: string;
}) | (DatabaseCommandOptions & {
    /** Destructively recreates the configured database. */
    command: 'wipe';
});
/**
 * Runs a data-table database command from structured invocation options.
 *
 * @param options Database command and application database values.
 * @returns The exit code the host CLI should use. Always resolves `0`;
 * command failures throw.
 */
export declare function runRemixDb(options: RunRemixDbOptions): Promise<number>;
export {};
//# sourceMappingURL=cli.d.ts.map