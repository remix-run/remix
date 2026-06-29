import * as process from 'node:process';
import { bootstrapProject } from "../bootstrap-project.js";
import { renderCliError, missingTargetDirectory, toCliError } from "../errors.js";
import { getDisplayPath } from "../display-path.js";
import { formatHelpText } from "../help-text.js";
import { parseArgs } from "../parse-args.js";
import { createCommandReporter, createStepProgressReporter, } from "../reporter.js";
const NEW_PROGRESS_LABELS = {
    'finalize-package-json': 'Finalize package.json',
    'generate-scaffold-files': 'Generate scaffold files',
    'prepare-target-directory': 'Prepare target directory',
};
export async function runNewCommand(argv, context) {
    if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getNewCommandHelpText());
        return 0;
    }
    let reporter = null;
    let progress = null;
    try {
        let options = parseNewCommandArgs(argv);
        reporter = createCommandReporter({ remixVersion: context.remixVersion });
        progress = createNewProgressReporter(reporter);
        await reporter.status.commandHeader('new');
        let result = await bootstrapProject({
            ...options,
            cwd: context.cwd,
            remixVersion: context.remixVersion,
        }, progress);
        progress.writeSummaryGap();
        reporter.out.line(`Created ${result.appDisplayName} at ${getDisplayPath(result.targetDir, context.cwd)}`);
        reporter.finish();
        return 0;
    }
    catch (error) {
        progress?.writeSummaryGap();
        process.stderr.write(renderCliError(toCliError(error), { helpText: getNewCommandHelpText(process.stderr) }));
        reporter?.finish();
        return 1;
    }
}
export function getNewCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Create a new Remix project in the target directory.',
        examples: [
            'remix new ./my-remix-app',
            'remix new ./my-remix-app --app-name "My Remix App"',
            'remix new ./my-remix-app --force',
        ],
        usage: ['remix new <target-dir> [--app-name <name>] [--force]'],
    }, target);
}
function parseNewCommandArgs(argv) {
    let parsed = parseArgs(argv, {
        appName: { flag: '--app-name', type: 'string' },
        force: { flag: '--force', type: 'boolean' },
    }, { maxPositionals: 1 });
    let targetDir = parsed.positionals[0] ?? null;
    if (targetDir == null) {
        throw missingTargetDirectory();
    }
    return {
        appName: parsed.options.appName ?? null,
        force: parsed.options.force,
        targetDir,
    };
}
function createNewProgressReporter(reporter) {
    return createStepProgressReporter(reporter.status, NEW_PROGRESS_LABELS);
}
