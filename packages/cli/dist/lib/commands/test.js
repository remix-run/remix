import * as process from 'node:process';
import { renderCliError, toCliError } from "../errors.js";
export async function runTestCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(`${await getTestCommandHelpText()}\n`);
        return 0;
    }
    try {
        let { runRemixTest } = await import('@remix-run/test/cli');
        return await runRemixTest({ argv, cwd: context.cwd });
    }
    catch (error) {
        let helpText = await getTestCommandHelpText(process.stderr);
        process.stderr.write(renderCliError(toCliError(error), {
            helpText,
        }));
        return 1;
    }
}
export async function getTestCommandHelpText(target = process.stdout) {
    let { getRemixTestHelpText } = await import('@remix-run/test/cli');
    return getRemixTestHelpText(target);
}
