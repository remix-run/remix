import * as process from 'node:process';
import { remixVersionUnavailable, renderCliError, toCliError } from "../errors.js";
import { formatHelpText } from "../help-text.js";
import { parseArgs } from "../parse-args.js";
export async function runVersionCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getVersionCommandHelpText());
        return 0;
    }
    try {
        parseArgs(argv, {}, { maxPositionals: 0 });
        if (context.remixVersion == null) {
            throw remixVersionUnavailable();
        }
        process.stdout.write(`${context.remixVersion}\n`);
        return 0;
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getVersionCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getVersionCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Show the current Remix version.',
        examples: ['remix version', 'remix --version'],
        usage: ['remix version'],
    }, target);
}
