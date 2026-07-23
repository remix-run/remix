import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importModule } from "./import-module.js";
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
export async function loadConfig(invocationConfig = {}, configPath, cwd = process.cwd()) {
    let fileConfig = await loadConfigFile(configPath, cwd);
    return resolveConfig(fileConfig, invocationConfig);
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
function resolveConfig(fileConfig, invocationConfig) {
    let fileCoverage = typeof fileConfig.coverage === 'boolean' ? {} : fileConfig.coverage || {};
    let invocationCoverage = typeof invocationConfig.coverage === 'boolean' ? {} : invocationConfig.coverage || {};
    let coverageEnabled = isCoverageEnabled(invocationConfig.coverage, fileConfig.coverage);
    return {
        glob: {
            test: toArray(invocationConfig.glob?.test ?? fileConfig.glob?.test ?? defaultValues.glob.test),
            browser: toArray(invocationConfig.glob?.browser ?? fileConfig.glob?.browser ?? defaultValues.glob.browser),
            e2e: toArray(invocationConfig.glob?.e2e ?? fileConfig.glob?.e2e ?? defaultValues.glob.e2e),
            exclude: toArray(invocationConfig.glob?.exclude ?? fileConfig.glob?.exclude ?? defaultValues.glob.exclude),
        },
        browser: {
            echo: invocationConfig.browser?.echo ?? fileConfig.browser?.echo ?? defaultValues.browser.echo,
            open: invocationConfig.browser?.open ?? fileConfig.browser?.open ?? defaultValues.browser.open,
        },
        concurrency: resolveConcurrency(invocationConfig.concurrency ?? fileConfig.concurrency ?? defaultValues.concurrency),
        coverage: coverageEnabled
            ? {
                dir: invocationCoverage.dir ?? fileCoverage.dir ?? defaultValues.coverage.dir,
                include: optionalArray(invocationCoverage.include ?? fileCoverage.include ?? defaultValues.coverage.include),
                exclude: optionalArray(invocationCoverage.exclude ?? fileCoverage.exclude ?? defaultValues.coverage.exclude),
                statements: optionalNumber(invocationCoverage.statements ?? fileCoverage.statements, 'coverage.statements'),
                lines: optionalNumber(invocationCoverage.lines ?? fileCoverage.lines, 'coverage.lines'),
                branches: optionalNumber(invocationCoverage.branches ?? fileCoverage.branches, 'coverage.branches'),
                functions: optionalNumber(invocationCoverage.functions ?? fileCoverage.functions, 'coverage.functions'),
            }
            : undefined,
        setup: invocationConfig.setup ?? fileConfig.setup ?? defaultValues.setup,
        playwrightConfig: invocationConfig.playwrightConfig ??
            fileConfig.playwrightConfig ??
            defaultValues.playwrightConfig,
        pool: resolvePool(invocationConfig.pool ?? fileConfig.pool ?? defaultValues.pool),
        only: resolveOnlyPatterns(invocationConfig.only ?? fileConfig.only),
        project: (() => {
            let raw = invocationConfig.project ?? fileConfig.project ?? defaultValues.project;
            return raw === undefined ? undefined : toCommaSeparatedArray(raw);
        })(),
        quiet: invocationConfig.quiet ?? fileConfig.quiet ?? defaultValues.quiet,
        reporter: invocationConfig.reporter ?? fileConfig.reporter ?? defaultValues.reporter,
        type: toCommaSeparatedArray(invocationConfig.type ?? fileConfig.type ?? defaultValues.type),
        watch: invocationConfig.watch ?? fileConfig.watch ?? defaultValues.watch,
    };
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
function isCoverageEnabled(invocationCoverage, fileCoverage) {
    if (typeof invocationCoverage === 'boolean')
        return invocationCoverage;
    if (invocationCoverage == null)
        return isFileCoverageEnabled(fileCoverage);
    if (invocationCoverage.enabled === 'inherit')
        return isFileCoverageEnabled(fileCoverage);
    return invocationCoverage.enabled !== false;
}
function isFileCoverageEnabled(coverage) {
    if (typeof coverage === 'boolean')
        return coverage;
    return coverage != null && coverage.enabled !== false;
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
    let escaped = false;
    for (let index = pattern.length - 1; index > 0; index--) {
        let char = pattern[index];
        if (char === '/' && !escaped) {
            return {
                source: pattern.slice(1, index),
                flags: pattern.slice(index + 1),
            };
        }
        escaped = char === '\\' && !escaped;
    }
    return undefined;
}
async function loadConfigFile(configPath, cwd) {
    let candidates = configPath
        ? [path.resolve(cwd, configPath)]
        : [path.join(cwd, 'remix-test.config.ts'), path.join(cwd, 'remix-test.config.js')];
    for (let candidate of candidates) {
        try {
            await fsp.access(candidate);
        }
        catch {
            // not found — try the next candidate
            continue;
        }
        // The file exists; let import errors propagate rather than silently
        // falling through to defaults — that masking is what hid "Windows
        // absolute paths aren't valid ESM specifiers" by classifying every
        // browser test as a server test.
        let mod = await importModule(candidate, import.meta);
        return mod.default ?? mod;
    }
    return {};
}
