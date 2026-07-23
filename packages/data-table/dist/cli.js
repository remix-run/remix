/**
 * Runs a data-table database command from structured invocation options.
 *
 * @param options Database command and application database values.
 * @returns The exit code the host CLI should use. Always resolves `0`;
 * command failures throw.
 */
export async function runRemixDb(options) {
    if (options.command === 'migrate') {
        let migrateOptions = options.to === undefined ? undefined : { to: options.to };
        let result = await options.db.migrate(await options.getMigrations(), migrateOptions);
        if (result.applied.length === 0) {
            console.log('no pending migrations');
        }
        for (let entry of result.applied) {
            console.log('applied ' + entry.id + '_' + entry.name);
        }
        return 0;
    }
    if (options.command === 'reset') {
        await options.db.reset({
            migrations: await options.getMigrations(),
            seed: options.seed,
        });
        console.log('database reset');
        return 0;
    }
    if (options.command === 'seed') {
        await options.seed(options.db);
        return 0;
    }
    if (options.command === 'status') {
        let entries = await options.db.migrationStatus(await options.getMigrations());
        for (let entry of entries) {
            console.log(entry.id + ' ' + entry.name + ' ' + entry.status);
        }
        return 0;
    }
    if (options.command === 'wipe') {
        await options.db.wipe();
        return 0;
    }
    // Guard against unchecked command strings from plain-JS callers so an
    // unknown command can never fall through to a destructive operation.
    let command = options.command;
    throw new Error('Unknown database command: ' + command);
}
