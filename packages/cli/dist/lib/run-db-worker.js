import * as path from 'node:path';
import * as process from 'node:process';
import { runRemixDb } from '@remix-run/data-table/cli';
import { loadModule } from '@remix-run/node-tsx/load-module';
import { isDatabaseCommand } from "./database-command.js";
// Expected failures carry tailored guidance and print message-only; any other
// error keeps its stack so users can see where their app code failed.
class ExpectedWorkerError extends Error {
}
void run().then(exit, fail);
async function run() {
    let invocation = parseInvocation(process.argv[2]);
    let databaseModule = await loadDatabaseModule();
    let db = databaseModule.db;
    if (db === undefined) {
        throw new ExpectedWorkerError('app/db.ts must export db');
    }
    if (invocation.command === 'wipe') {
        return runRemixDb({ command: invocation.command, db });
    }
    if (invocation.command === 'seed') {
        let seed = databaseModule.seed;
        if (seed === undefined) {
            throw new ExpectedWorkerError('app/db.ts must export a seed function to run db seed');
        }
        return runRemixDb({ command: invocation.command, db, seed });
    }
    let getMigrations = databaseModule.getMigrations;
    if (getMigrations === undefined) {
        throw new ExpectedWorkerError(`app/db.ts must export getMigrations to run db ${invocation.command}`);
    }
    if (invocation.command === 'migrate') {
        return runRemixDb({
            command: invocation.command,
            db,
            getMigrations,
            to: invocation.to,
        });
    }
    if (invocation.command === 'reset') {
        return runRemixDb({
            command: invocation.command,
            db,
            getMigrations,
            seed: databaseModule.seed,
        });
    }
    return runRemixDb({ command: invocation.command, db, getMigrations });
}
async function loadDatabaseModule() {
    let databaseModulePath = path.resolve('app/db.ts');
    let value = await loadModule(databaseModulePath, import.meta.url);
    if (typeof value !== 'object' || value === null) {
        throw new ExpectedWorkerError('app/db.ts must export a database module');
    }
    return value;
}
function parseInvocation(value) {
    if (value === undefined) {
        throw new Error('Missing database command invocation.');
    }
    let parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null || !('command' in parsed)) {
        throw new Error('Invalid database command invocation.');
    }
    let command = parsed.command;
    if (!isDatabaseCommand(command)) {
        throw new Error('Invalid database command invocation.');
    }
    let to = 'to' in parsed ? parsed.to : undefined;
    if (to !== undefined && typeof to !== 'string') {
        throw new Error('Invalid database migration target.');
    }
    return { command, to };
}
function exit(code) {
    exitAfterFlushing(code);
}
function fail(error) {
    process.stderr.write(`${getFailureOutput(error)}\n`);
    exitAfterFlushing(1);
}
function getFailureOutput(error) {
    if (error instanceof ExpectedWorkerError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.stack ?? error.message;
    }
    return String(error);
}
function exitAfterFlushing(code) {
    let pendingStreams = 2;
    function onFlushed() {
        pendingStreams -= 1;
        if (pendingStreams === 0) {
            process.exit(code);
        }
    }
    process.stdout.write('', onFlushed);
    process.stderr.write('', onFlushed);
}
