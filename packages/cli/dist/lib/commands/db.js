import { spawn } from 'node:child_process';
import * as process from 'node:process';
import { fileURLToPath } from 'node:url';
import { findAppRoot } from "../app-root.js";
import { isDatabaseCommand } from "../database-command.js";
import { dbFileNotFound, dbForceRequired, renderCliError, toCliError, unknownCommand, } from "../errors.js";
import { formatHelpText } from "../help-text.js";
import { parseArgs } from "../parse-args.js";
export async function runDbCommand(argv, context) {
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getDbCommandHelpText());
        return 0;
    }
    try {
        let invocation = parseDbCommandArgs(argv);
        return await runDatabaseCommandScript(invocation, context.cwd);
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getDbCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getDbCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Manage the current app database.',
        examples: [
            'remix db wipe --force',
            'remix db migrate',
            'remix db migrate --to 20260715123000_add_users',
            'remix db status',
            'remix db seed',
            'remix db reset --force',
        ],
        options: [
            {
                description: 'Confirm a destructive command (wipe and reset only)',
                label: '--force',
            },
            {
                description: 'Stop after applying the specified migration (migrate only)',
                label: '--to <migration>',
            },
        ],
        usage: [
            'remix db wipe --force',
            'remix db migrate [--to <migration>]',
            'remix db status',
            'remix db seed',
            'remix db reset --force',
        ],
    }, target);
}
function parseDbCommandArgs(argv) {
    let [command, ...commandArgv] = argv;
    if (!isDatabaseCommand(command)) {
        throw unknownCommand(`db ${command}`);
    }
    if (command === 'migrate') {
        let parsed = parseArgs(commandArgv, {
            to: { flag: '--to', type: 'string' },
        }, { maxPositionals: 0 });
        return { command, to: parsed.options.to };
    }
    if (command === 'reset' || command === 'wipe') {
        let parsed = parseArgs(commandArgv, {
            force: { flag: '--force', type: 'boolean' },
        }, { maxPositionals: 0 });
        if (!parsed.options.force) {
            throw dbForceRequired(command);
        }
        return { command };
    }
    parseArgs(commandArgv, {}, { maxPositionals: 0 });
    return { command };
}
async function runDatabaseCommandScript(invocation, cwd) {
    let appRoot = await findAppRoot(cwd, 'app/db.ts');
    if (appRoot == null) {
        throw dbFileNotFound(cwd);
    }
    let workerPath = getDatabaseCommandWorkerPath();
    // The worker resolves app/db.ts against its cwd, so spawn it from the
    // discovered app root rather than the caller's directory.
    let child = spawn(process.execPath, [workerPath, JSON.stringify(invocation)], {
        cwd: appRoot,
        env: createDatabaseCommandWorkerEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });
    let result = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (result.signal != null) {
        throw new Error(`Database command exited from signal ${result.signal}.`);
    }
    if (result.code !== 0) {
        throw new Error(stderr.trim() || 'Database command failed.');
    }
    if (stderr.length > 0) {
        process.stderr.write(stderr);
    }
    return 0;
}
function getDatabaseCommandWorkerPath() {
    let currentFilePath = fileURLToPath(import.meta.url);
    let extension = currentFilePath.endsWith('.ts') ? '.ts' : '.js';
    return fileURLToPath(new URL(`../run-db-worker${extension}`, import.meta.url));
}
function createDatabaseCommandWorkerEnv() {
    let env = { ...process.env };
    for (let key of Object.keys(env)) {
        if (key.startsWith('NODE_TEST_')) {
            delete env[key];
        }
    }
    return env;
}
