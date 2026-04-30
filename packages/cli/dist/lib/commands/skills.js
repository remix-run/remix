import * as process from 'node:process';
import { getDisplayPath } from "../display-path.js";
import { renderCliError, toCliError, unknownSkillsCommand } from "../errors.js";
import { formatHelpText } from "../help-text.js";
import { parseArgs } from "../parse-args.js";
import { getSkillsOverview, installRemixSkills } from "../skills.js";
import { createCommandReporter, createStepProgressReporter, } from "../reporter.js";
const SKILLS_PROGRESS_LABELS = {
    'compare-local-skills': 'Compare local skills',
    'download-remix-skills-archive': 'Download Remix skills archive',
    'fetch-remix-skills-metadata': 'Fetch Remix skills metadata from GitHub',
    'read-local-skills-cache': 'Read local skills cache',
    'resolve-project-root': 'Resolve project root',
    'write-updated-skills': 'Write updated skills',
};
export async function runSkillsCommand(argv, context) {
    if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
        process.stdout.write(getSkillsCommandHelpText());
        return 0;
    }
    let [subcommand, ...rest] = argv;
    try {
        if (subcommand === 'install') {
            return await runSkillsInstallCommand(rest, context);
        }
        if (subcommand === 'list') {
            return await runSkillsListCommand(rest, context);
        }
        throw unknownSkillsCommand(subcommand);
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getSkillsCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getSkillsCommandHelpText(target = process.stdout) {
    return formatHelpText({
        commands: [
            {
                description: 'Install Remix skills into a local directory',
                label: 'install [--dir <path>]',
            },
            {
                description: 'List Remix skills and local status',
                label: 'list [--dir <path>] [--json]',
            },
        ],
        description: 'Manage Remix skills for the current project.',
        examples: [
            'remix skills install',
            'remix skills install --dir custom/skills',
            'remix skills list --dir custom/skills',
            'remix skills list --json',
        ],
        usage: ['remix skills <command>'],
    }, target);
}
export function getSkillsInstallCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Install or refresh Remix skills in .agents/skills for the current project.',
        examples: ['remix skills install', 'remix skills install --dir custom/skills'],
        options: [
            {
                description: 'Install skills into a custom directory relative to the project root',
                label: '--dir <path>',
            },
        ],
        usage: ['remix skills install [--dir <path>]'],
    }, target);
}
export function getSkillsListCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'List Remix skills and show whether each one is installed, outdated, or missing locally.',
        examples: [
            'remix skills list',
            'remix skills list --dir custom/skills',
            'remix skills list --json',
        ],
        options: [
            {
                description: 'Read local skills from a custom directory relative to the project root',
                label: '--dir <path>',
            },
            { description: 'Print skill state as JSON', label: '--json' },
        ],
        usage: ['remix skills list [--dir <path>] [--json]'],
    }, target);
}
async function runSkillsInstallCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getSkillsInstallCommandHelpText());
        return 0;
    }
    let reporter = null;
    let progress = null;
    try {
        let options = parseSkillsInstallCommandArgs(argv);
        reporter = createCommandReporter({ remixVersion: context.remixVersion });
        progress = createSkillsProgressReporter(reporter);
        let cwd = context.cwd;
        await reporter.status.commandHeader('skills install');
        let result = await installRemixSkills(cwd, globalThis.fetch, {
            progress,
            skillsDir: options.dir ?? undefined,
        });
        let skillsDir = getDisplayPath(result.skillsDir, cwd);
        progress.writeSummaryGap();
        if (result.appliedChanges.length === 0) {
            reporter.out.line(`No changes. ${skillsDir} is up to date.`);
            reporter.finish();
            return 0;
        }
        reporter.out.line(`Synced Remix skills into ${skillsDir}:`);
        reporter.out.bullets(formatAppliedChanges(result.appliedChanges));
        reporter.finish();
        return 0;
    }
    catch (error) {
        progress?.writeSummaryGap();
        process.stderr.write(renderCliError(toCliError(error), {
            helpText: getSkillsInstallCommandHelpText(process.stderr),
        }));
        reporter?.finish();
        return 1;
    }
}
async function runSkillsListCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getSkillsListCommandHelpText());
        return 0;
    }
    let reporter = null;
    let progress = null;
    try {
        let options = parseSkillsDirArgs(argv, { allowJson: true });
        let cwd = context.cwd;
        reporter = options.json ? null : createCommandReporter({ remixVersion: context.remixVersion });
        if (reporter != null) {
            progress = createSkillsProgressReporter(reporter);
            await reporter.status.commandHeader('skills list');
        }
        let result = await getSkillsOverview(cwd, globalThis.fetch, {
            progress: progress ?? undefined,
            skillsDir: options.dir ?? undefined,
        });
        if (options.json) {
            process.stdout.write(`${JSON.stringify({
                entries: result.entries,
                projectRoot: result.projectRoot,
                skillsDir: result.skillsDir,
            }, null, 2)}\n`);
            return 0;
        }
        progress?.writeSummaryGap();
        if (reporter == null) {
            return 0;
        }
        let listReporter = reporter;
        listReporter.out.line(formatSkillsListSummary(result.entries, getDisplayPath(result.skillsDir, cwd)));
        listReporter.out.bullets(result.entries.map((entry) => formatSkillListEntry(listReporter, entry)));
        listReporter.finish();
        return 0;
    }
    catch (error) {
        progress?.writeSummaryGap();
        process.stderr.write(renderCliError(toCliError(error), { helpText: getSkillsListCommandHelpText(process.stderr) }));
        reporter?.finish();
        return 1;
    }
}
function createSkillsProgressReporter(reporter) {
    return createStepProgressReporter(reporter.status, SKILLS_PROGRESS_LABELS);
}
function formatAppliedChanges(changes) {
    let showAction = changes.some((change) => change.action !== 'add');
    return changes.map((change) => showAction ? `${toPastTense(change.action)} ${change.name}` : change.name);
}
function formatSkillListEntry(reporter, entry) {
    if (entry.state === 'installed') {
        return entry.name;
    }
    let tone = entry.state === 'missing' ? 'error' : 'warn';
    return `${entry.name} ${reporter.out.label(entry.state, '', { tone })}`;
}
function formatSkillsListSummary(entries, skillsDir) {
    let installedCount = entries.filter((entry) => entry.state === 'installed').length;
    let outdatedCount = entries.filter((entry) => entry.state === 'outdated').length;
    let missingCount = entries.filter((entry) => entry.state === 'missing').length;
    let detailParts = [
        installedCount > 0 ? `${installedCount} installed` : null,
        outdatedCount > 0 ? `${outdatedCount} outdated` : null,
        missingCount > 0 ? `${missingCount} missing` : null,
    ].filter((part) => part != null);
    let detail = detailParts.length === 0 ? '0 installed' : detailParts.join(', ');
    return `Checked Remix skills against ${skillsDir}: ${detail}.`;
}
function parseSkillsInstallCommandArgs(argv) {
    let { dir } = parseSkillsDirArgs(argv);
    return { dir };
}
function parseSkillsDirArgs(argv, options = {}) {
    if (options.allowJson) {
        let parsed = parseArgs(argv, {
            dir: { flag: '--dir', type: 'string' },
            json: { flag: '--json', type: 'boolean' },
        }, { maxPositionals: 0 });
        return {
            dir: parsed.options.dir ?? null,
            json: parsed.options.json,
        };
    }
    let parsed = parseArgs(argv, {
        dir: { flag: '--dir', type: 'string' },
    }, { maxPositionals: 0 });
    return {
        dir: parsed.options.dir ?? null,
        json: false,
    };
}
function toPastTense(action) {
    return action === 'add' ? 'added' : 'replaced';
}
