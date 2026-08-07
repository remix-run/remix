import type { Database } from './lib/database.ts';
import type { GetMigrations, Seed } from './lib/migrations.ts';
interface DatabaseCommandOptions {
    /** Database instance exported by the application database module. */
    db: Database;
}
/** Structured invocation options accepted by {@link runRemixDb}. */
export type RunRemixDbOptions = (DatabaseCommandOptions & {
    /** Applies pending migrations. */
    command: 'migrate';
    /** Loads the migrations to apply. */
    getMigrations: GetMigrations;
    /**
     * Stops after applying this migration. Accepts a bare migration id or
     * the full `id_name` directory form.
     */
    to?: string;
}) | (DatabaseCommandOptions & {
    /** Wipes, migrates, and optionally seeds the database. */
    command: 'reset';
    /** Loads the migrations to apply after wiping the database. */
    getMigrations: GetMigrations;
    /** Initializes database data after migrations finish. */
    seed?: Seed;
}) | (DatabaseCommandOptions & {
    /** Runs the application's seed function. */
    command: 'seed';
    /** Initializes application database data. */
    seed: Seed;
}) | (DatabaseCommandOptions & {
    /** Reports the status of known migrations. */
    command: 'status';
    /** Loads the migrations to inspect. */
    getMigrations: GetMigrations;
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