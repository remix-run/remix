import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
export const IS_RUNNING_FROM_SRC = path.extname(new URL(import.meta.url).pathname) === '.ts';
/*
 * The root directory for the test code. Coverage URLs are emitted as
 * `/scripts/<rel-from-rootDir>` and resolved back via the same anchor.
 *
 *   - In a published install: `process.cwd()`, since deps and user source all
 *     live under it.
 *   - In monorepo src mode: the monorepo root, computed by walking back from
 *     the resolved `@remix-run/test` source path. `process.cwd()` doesn't work
 *     here because workspace deps and node_modules live above the per-package
 *     cwd.
 */
export function getBrowserTestRootDir() {
    return IS_RUNNING_FROM_SRC
        ? // Resolve to packages/test/src/index.ts and the pop 3 directories off to the repo root
            path
                .dirname(fileURLToPath(import.meta.resolve('@remix-run/test')))
                .split(path.sep)
                .slice(0, -3)
                .join(path.sep)
        : process.cwd();
}
const defaultValues = {
    browser: {
        echo: false,
        open: false,
    },
    concurrency: os.availableParallelism(),
    coverage: {
        dir: '.coverage',
        include: undefined,
        exclude: undefined,
        statements: undefined,
        lines: undefined,
        branches: undefined,
        functions: undefined,
    },
    glob: {
        test: ['**/*.test{,.e2e,.browser}.{ts,tsx}'],
        browser: ['**/*.test.browser.{ts,tsx}'],
        e2e: ['**/*.test.e2e.{ts,tsx}'],
        exclude: ['node_modules/**'],
    },
    pool: 'forks',
    only: undefined,
    playwrightConfig: undefined,
    project: undefined,
    quiet: false,
    reporter: process.env.CI === 'true' ? 'files' : 'spec',
    setup: undefined,
    type: ['server', 'browser', 'e2e'],
    watch: false,
};
/**
 * Worker pools supported by the Remix test runner.
 */
export const remixTestPools = ['forks', 'threads'];
export function resolveConfig(config = {}) {
    let coverageOptions = typeof config.coverage === 'boolean' ? {} : config.coverage || {};
    let coverageEnabled = isCoverageEnabled(config.coverage);
    return {
        glob: {
            test: toArray(config.glob?.test ?? defaultValues.glob.test),
            browser: toArray(config.glob?.browser ?? defaultValues.glob.browser),
            e2e: toArray(config.glob?.e2e ?? defaultValues.glob.e2e),
            exclude: toArray(config.glob?.exclude ?? defaultValues.glob.exclude),
        },
        browser: {
            echo: config.browser?.echo ?? defaultValues.browser.echo,
            open: config.browser?.open ?? defaultValues.browser.open,
        },
        concurrency: resolveConcurrency(config.concurrency ?? defaultValues.concurrency),
        coverage: coverageEnabled
            ? {
                dir: coverageOptions.dir ?? defaultValues.coverage.dir,
                include: optionalArray(coverageOptions.include ?? defaultValues.coverage.include),
                exclude: optionalArray(coverageOptions.exclude ?? defaultValues.coverage.exclude),
                statements: optionalNumber(coverageOptions.statements, 'coverage.statements'),
                lines: optionalNumber(coverageOptions.lines, 'coverage.lines'),
                branches: optionalNumber(coverageOptions.branches, 'coverage.branches'),
                functions: optionalNumber(coverageOptions.functions, 'coverage.functions'),
            }
            : undefined,
        setup: config.setup ?? defaultValues.setup,
        playwrightConfig: config.playwrightConfig ?? defaultValues.playwrightConfig,
        pool: resolvePool(config.pool ?? defaultValues.pool),
        only: resolveOnlyPatterns(config.only),
        project: (() => {
            let raw = config.project ?? defaultValues.project;
            return raw === undefined ? undefined : toCommaSeparatedArray(raw);
        })(),
        quiet: config.quiet ?? defaultValues.quiet,
        reporter: config.reporter ?? defaultValues.reporter,
        type: toCommaSeparatedArray(config.type ?? defaultValues.type),
        watch: config.watch ?? defaultValues.watch,
    };
}
function toArray(value) {
    return Array.isArray(value) ? [...value] : [value];
}
function toCommaSeparatedArray(value) {
    return toArray(value).flatMap((item) => item
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean));
}
function optionalArray(input) {
    return input === undefined ? undefined : toArray(input);
}
function optionalNumber(input, name) {
    if (input === undefined)
        return undefined;
    let value = Number(input);
    if (Number.isNaN(value)) {
        throw new Error(`Invalid ${name} value "${input}". Expected a number`);
    }
    return value;
}
function resolveConcurrency(value) {
    let concurrency = Number(value);
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new Error(`Invalid concurrency value "${value}". Expected a positive integer`);
    }
    return concurrency;
}
function isCoverageEnabled(coverage) {
    if (typeof coverage === 'boolean')
        return coverage;
    return coverage != null && coverage.enabled !== false && coverage.enabled !== 'inherit';
}
function resolvePool(value) {
    if (remixTestPools.includes(value)) {
        return value;
    }
    throw new Error(`Unsupported test pool "${value}". Supported pools are: ${remixTestPools.join(', ')}`);
}
function resolveOnlyPatterns(value) {
    if (value === undefined)
        return undefined;
    return toArray(value).map((pattern) => {
        let serialized;
        if (typeof pattern === 'string') {
            serialized = parseRegexLiteral(pattern) ?? { source: pattern, flags: 'i' };
        }
        else {
            serialized = { source: pattern.source, flags: pattern.flags };
        }
        try {
            new RegExp(serialized.source, serialized.flags);
        }
        catch (error) {
            let reason = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid --only pattern "${pattern}". ` +
                `--only patterns must be valid JavaScript regular expressions, ` +
                `or regex literals like "/pattern/flags". ${reason}`);
        }
        return serialized;
    });
}
function parseRegexLiteral(pattern) {
    if (!pattern.startsWith('/') || pattern.length < 2)
        return undefined;
    // The closing delimiter is the last unescaped slash; escape state must be
    // tracked left-to-right since it depends on the preceding backslashes.
    let closingIndex = -1;
    let escaped = false;
    for (let index = 1; index < pattern.length; index++) {
        if (escaped) {
            escaped = false;
        }
        else if (pattern[index] === '\\') {
            escaped = true;
        }
        else if (pattern[index] === '/') {
            closingIndex = index;
        }
    }
    if (closingIndex === -1)
        return undefined;
    return {
        source: pattern.slice(1, closingIndex),
        flags: pattern.slice(closingIndex + 1),
    };
}
