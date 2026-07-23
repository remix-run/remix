import * as process from 'node:process';
import { parseArgs } from 'node:util';
import { invalidOptionValue, missingOptionValue, renderCliError, toCliError, unknownArgument, } from "../errors.js";
import { formatHelpText } from "../help-text.js";
const testCommandOptions = {
    'browser.echo': { type: 'boolean' },
    'browser.open': { type: 'boolean' },
    'glob.browser': { type: 'string', multiple: true },
    'glob.e2e': { type: 'string', multiple: true },
    'glob.exclude': { type: 'string', multiple: true },
    'glob.test': { type: 'string', multiple: true },
    concurrency: { type: 'string', short: 'c' },
    config: { type: 'string' },
    coverage: { type: 'boolean' },
    'coverage.dir': { type: 'string' },
    'coverage.include': { type: 'string', multiple: true },
    'coverage.exclude': { type: 'string', multiple: true },
    'coverage.branches': { type: 'string' },
    'coverage.functions': { type: 'string' },
    'coverage.lines': { type: 'string' },
    'coverage.statements': { type: 'string' },
    setup: { type: 'string', short: 's' },
    playwrightConfig: { type: 'string' },
    project: { type: 'string', short: 'p', multiple: true },
    pool: { type: 'string' },
    quiet: { type: 'boolean', short: 'q' },
    only: { type: 'string', multiple: true },
    reporter: { type: 'string', short: 'r' },
    type: { type: 'string', short: 't', multiple: true },
    watch: { type: 'boolean', short: 'w' },
};
// The annotation keeps this table in lockstep with `testCommandOptions`: adding
// or removing a flag without updating its metadata is a compile error.
const testCommandFlagMeta = {
    'browser.echo': { description: 'Echo browser console output' },
    'browser.open': { description: 'Open the browser after tests finish' },
    'glob.browser': {
        description: 'Glob pattern for browser test files',
        valueHint: 'glob',
        files: true,
    },
    'glob.e2e': { description: 'Glob pattern for E2E test files', valueHint: 'glob', files: true },
    'glob.exclude': {
        description: 'Glob pattern to exclude from discovery',
        valueHint: 'glob',
        files: true,
    },
    'glob.test': {
        description: 'Glob pattern for all test files',
        valueHint: 'glob',
        files: true,
        default: '**/*.test{,.e2e,.browser}.{ts,tsx}',
    },
    concurrency: {
        description: 'Maximum concurrent test workers',
        valueHint: 'count',
        default: 'os.availableParallelism()',
    },
    config: {
        description: 'Path to a test config file',
        valueHint: 'path',
        files: true,
        default: 'remix-test.config.ts',
    },
    coverage: { description: 'Collect test coverage', default: 'false' },
    'coverage.dir': {
        description: 'Coverage report output directory',
        valueHint: 'path',
        default: '.coverage',
    },
    'coverage.include': { description: 'Coverage inclusion glob', valueHint: 'glob' },
    'coverage.exclude': { description: 'Coverage exclusion glob', valueHint: 'glob' },
    'coverage.branches': { description: 'Minimum branch coverage percentage', valueHint: 'percent' },
    'coverage.functions': {
        description: 'Minimum function coverage percentage',
        valueHint: 'percent',
    },
    'coverage.lines': { description: 'Minimum line coverage percentage', valueHint: 'percent' },
    'coverage.statements': {
        description: 'Minimum statement coverage percentage',
        valueHint: 'percent',
    },
    setup: { description: 'Path to a setup module', valueHint: 'path', files: true },
    playwrightConfig: {
        description: 'Path to a Playwright config file',
        valueHint: 'path',
        files: true,
    },
    project: { description: 'Playwright project name', valueHint: 'name' },
    pool: { description: 'Worker pool: forks or threads', valueHint: 'pool', default: 'forks' },
    quiet: { description: 'Do not print skipped tests' },
    only: { description: 'Test name pattern', valueHint: 'pattern' },
    reporter: {
        description: 'Reporter: spec, files, tap, or dot',
        valueHint: 'name',
        default: 'spec',
    },
    type: {
        description: 'Test type: server, browser, or e2e',
        valueHint: 'type',
        default: 'server, browser, e2e',
    },
    watch: { description: 'Re-run tests when files change' },
};
export const testCommandFlags = Object.entries(testCommandOptions).map(([name, option]) => ({
    name: `--${name}`,
    alias: option.short === undefined ? undefined : `-${option.short}`,
    type: option.type,
    multiple: option.multiple === true,
    files: testCommandFlagMeta[name].files === true,
}));
export async function runTestCommand(argv, context) {
    if (wantsHelp(argv)) {
        process.stdout.write(getTestCommandHelpText());
        return 0;
    }
    try {
        let { remixTestPools, runRemixTest } = await import('@remix-run/test/cli');
        let options = parseTestCommandArgs(argv, remixTestPools);
        return await runRemixTest({ ...options, cwd: context.cwd });
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), {
            helpText: getTestCommandHelpText(process.stderr),
        }));
        return 1;
    }
}
export function getTestCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'Run tests for the current project.',
        examples: [
            'remix test',
            'remix test app/**/*.test.ts',
            'remix test --type server --concurrency 1',
            'remix test --coverage',
            'remix test --watch',
        ],
        options: [
            ...Object.entries(testCommandOptions).map(([name, option]) => {
                let meta = testCommandFlagMeta[name];
                let short = 'short' in option ? `-${option.short}, ` : '';
                let value = option.type === 'string' ? ` <${meta.valueHint}>` : '';
                let repeatable = 'multiple' in option && option.multiple ? ' (repeatable)' : '';
                let defaultValue = meta.default === undefined ? '' : ` (default: ${meta.default})`;
                return {
                    description: `${meta.description}${repeatable}${defaultValue}`,
                    label: `${short}--${name}${value}`,
                };
            }),
            { description: 'Show help', label: '-h, --help' },
            { description: 'Disable ANSI color output', label: '--no-color' },
        ],
        usage: ['remix test [glob...] [options]'],
    }, target);
}
function wantsHelp(argv) {
    // Everything after a bare `--` is a positional test file glob, not a flag
    let separatorIndex = argv.indexOf('--');
    let flags = separatorIndex === -1 ? argv : argv.slice(0, separatorIndex);
    return flags.includes('-h') || flags.includes('--help');
}
function parseTestCommandArgs(argv, pools) {
    let parsed;
    try {
        parsed = parseTestCommandArgsRaw(argv);
    }
    catch (error) {
        throw toTestCommandUsageError(error);
    }
    let { positionals, values } = parsed;
    let coverage = createCoverageOptions(values);
    let glob = compactObject({
        browser: values['glob.browser'],
        e2e: values['glob.e2e'],
        exclude: values['glob.exclude'],
        test: positionals.length > 0 ? positionals : values['glob.test'],
    });
    return compactObject({
        browser: compactObject({
            echo: values['browser.echo'] || undefined,
            open: values['browser.open'] || undefined,
        }),
        concurrency: optionalPositiveInteger(values.concurrency, '--concurrency'),
        config: values.config,
        coverage,
        glob,
        only: values.only,
        playwrightConfig: values.playwrightConfig,
        pool: parsePool(values.pool, pools),
        project: values.project,
        quiet: values.quiet || undefined,
        reporter: values.reporter,
        setup: values.setup,
        type: values.type,
        watch: values.watch || undefined,
    });
}
function createCoverageOptions(values) {
    let options = compactObject({
        branches: optionalNumber(values['coverage.branches'], '--coverage.branches'),
        dir: values['coverage.dir'],
        exclude: values['coverage.exclude'],
        functions: optionalNumber(values['coverage.functions'], '--coverage.functions'),
        include: values['coverage.include'],
        lines: optionalNumber(values['coverage.lines'], '--coverage.lines'),
        statements: optionalNumber(values['coverage.statements'], '--coverage.statements'),
    });
    if (values.coverage) {
        return options ?? true;
    }
    // Coverage settings without --coverage refine the config file's coverage
    // options while leaving enablement up to the config file.
    return options == null ? undefined : { ...options, enabled: 'inherit' };
}
function parseTestCommandArgsRaw(argv) {
    return parseArgs({
        allowPositionals: true,
        args: argv,
        options: testCommandOptions,
    });
}
function optionalNumber(value, flag) {
    if (value === undefined) {
        return undefined;
    }
    let parsed = Number(value);
    if (value.trim() === '' || Number.isNaN(parsed)) {
        throw invalidOptionValue(`Invalid ${flag} value "${value}". Expected a number`);
    }
    return parsed;
}
function optionalPositiveInteger(value, flag) {
    let parsed = optionalNumber(value, flag);
    if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1)) {
        throw invalidOptionValue(`Invalid ${flag} value "${value}". Expected a positive integer`);
    }
    return parsed;
}
function parsePool(value, pools) {
    if (value === undefined || pools.includes(value)) {
        return value;
    }
    throw invalidOptionValue(`Unsupported test pool "${value}". Supported pools are: ${pools.join(', ')}`);
}
function compactObject(value) {
    return Object.values(value).every((entry) => entry === undefined) ? undefined : value;
}
function toTestCommandUsageError(error) {
    if (!isErrorWithCode(error)) {
        return error;
    }
    if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
        let option = error.message.match(/'([^']+)'/)?.[1];
        return unknownArgument(option ?? error.message);
    }
    if (error.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
        // parseArgs reports a flag with no value as an invalid-value error, e.g.
        // "Option '--config <value>' argument missing"; surface it as missing.
        let missing = error.message.match(/^Option '(.+?) <value>' argument missing/);
        if (missing !== null) {
            return missingOptionValue(missing[1]);
        }
        return invalidOptionValue(error.message);
    }
    return error;
}
function isErrorWithCode(error) {
    return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
