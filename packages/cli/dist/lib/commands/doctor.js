import * as process from 'node:process';
import { runRemixDoctor } from "../doctor/run.js";
import { renderCliError, toCliError } from "../errors.js";
import { formatHelpText } from "../help-text.js";
import { parseArgs } from "../parse-args.js";
export async function runDoctorCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getDoctorCommandHelpText());
        return 0;
    }
    try {
        let config = await context.loadConfig();
        let options = resolveDoctorCommandOptions(argv, config.doctor);
        return await runRemixDoctor({
            ...options,
            cwd: context.cwd,
            remixVersion: context.remixVersion,
        });
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getDoctorCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getDoctorCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Check project environment and Remix app conventions for the current project.',
        examples: [
            'remix doctor',
            'remix doctor --json',
            'remix doctor --strict',
            'remix doctor --fix',
        ],
        options: [
            { description: 'Print doctor findings as JSON', label: '--json' },
            {
                description: 'Exit with status 1 when warning-level findings are present',
                label: '--strict',
            },
            {
                description: 'Do not exit with status 1 when warning-level findings are present',
                label: '--no-strict',
            },
            { description: 'Apply low-risk project and action fixes', label: '--fix' },
        ],
        usage: ['remix doctor [--json] [--strict] [--fix] [--no-color]'],
    }, target);
}
export function resolveDoctorCommandOptions(argv, config) {
    let parsed = parseArgs(argv, {
        fix: { flag: '--fix', type: 'boolean' },
        json: { flag: '--json', type: 'boolean' },
        noStrict: { flag: '--no-strict', type: 'boolean' },
        strict: { flag: '--strict', type: 'boolean' },
    }, { maxPositionals: 0 });
    let strict = config?.strict ?? false;
    for (let arg of argv) {
        if (arg === '--strict')
            strict = true;
        if (arg === '--no-strict')
            strict = false;
    }
    return {
        fix: parsed.options.fix,
        json: parsed.options.json,
        strict,
    };
}
