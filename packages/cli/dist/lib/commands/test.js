import { getRemixTestHelpText, runRemixTest } from '@remix-run/test/cli';
import * as process from 'node:process';
import { renderCliError, toCliError } from "../errors.js";
export async function runTestCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(`${getTestCommandHelpText()}\n`);
        return 0;
    }
    try {
        return await runRemixTest({ argv, cwd: context.cwd });
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getTestCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getTestCommandHelpText(target = process.stdout) {
    return getRemixTestHelpText(target);
}
