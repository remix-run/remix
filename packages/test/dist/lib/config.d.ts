import type { PlaywrightTestConfig } from 'playwright/test';
export declare const IS_RUNNING_FROM_SRC: boolean;
export declare function getBrowserTestRootDir(): string;
/**
 * Worker pools supported by the Remix test runner.
 */
export declare const remixTestPools: readonly ["forks", "threads"];
/**
 * Worker pool used by Remix to run server and E2E test files.
 * `'forks'` (default) uses child processes for stronger isolation; `'threads'`
 * uses worker threads for projects that prefer lower-overhead startup.
 */
export type RemixTestPool = (typeof remixTestPools)[number];
export interface SerializedOnlyPattern {
    source: string;
    flags: string;
}
export type RemixTestOnlyPattern = string | RegExp;
/**
 * User-facing configuration for the Remix test runner. Every field is optional, and unset fields
 * fall back to runner defaults. This shape may be exported from a `remix-test.config.ts` file or
 * passed to `runRemixTest()`.
 */
export interface RemixTestConfig {
    /**
     * Options for controlling Playwright browsers.
     */
    browser?: {
        /** Echo browser console output to stdout. */
        echo?: boolean;
        /** Open a browser window and keep it open after tests finish. */
        open?: boolean;
    };
    /**
     * Glob patterns to identify test files. Each field accepts a single pattern
     * or an array of patterns; arrays are unioned during discovery.
     *  - `glob.test`: Glob pattern(s) for all test files (--glob.test)
     *  - `glob.browser`: Glob pattern(s) for the subset of browser test files (--glob.browser)
     *  - `glob.e2e`: Glob pattern(s) for the subset of e2e test files (--glob.e2e)
     *  - `glob.exclude`: Glob pattern(s) for paths to exclude from discovery (--glob.exclude)
     */
    glob?: {
        /** Glob patterns for all test files. */
        test?: string | string[];
        /** Glob patterns for the subset of browser test files. */
        browser?: string | string[];
        /** Glob patterns for the subset of E2E test files. */
        e2e?: string | string[];
        /** Glob patterns excluded from test discovery. */
        exclude?: string | string[];
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Coverage configuration. `true` enables with defaults; an object enables with settings;
     * `false` disables. CLI `--coverage` flag overrides the boolean aspect.
     */
    coverage?: boolean | {
        /**
         * Enables or disables coverage when specified. A coverage object enables coverage by
         * default. Invocation options may pass `'inherit'` to apply the object's settings while
         * deferring enablement to the config file (used by CLI flags like `--coverage.dir`).
         */
        enabled?: boolean | 'inherit';
        /** Directory where coverage reports are written. */
        dir?: string;
        /** Glob patterns for files included in coverage. */
        include?: string | string[];
        /** Glob patterns for files excluded from coverage. */
        exclude?: string | string[];
        /** Minimum statement coverage percentage. */
        statements?: number | string;
        /** Minimum line coverage percentage. */
        lines?: number | string;
        /** Minimum branch coverage percentage. */
        branches?: number | string;
        /** Minimum function coverage percentage. */
        functions?: number | string;
    };
    /**
     * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
     * called once before and after the test run respectively. (--setup)
     */
    setup?: string;
    /**
     * Playwright configuration — either a path to a playwright config file or an inline
     * PlaywrightTestConfig object. CLI `--playwrightConfig` only accepts a file path.
     */
    playwrightConfig?: string | PlaywrightTestConfig;
    /**
     * Pool used to run server and E2E test files. Forked child processes are the default,
     * but worker threads are available for projects that prefer the previous behavior.
     */
    pool?: RemixTestPool;
    /**
     * Regular expression pattern(s) to focus tests by their full name (--only).
     * Matching suite names focus the whole suite, while matching test names focus
     * the individual test. Plain string patterns are case-insensitive. Use a
     * slash-delimited pattern or a `RegExp` in the config file to control flags
     * explicitly. `--only` may be repeated on the CLI.
     */
    only?: RemixTestOnlyPattern | RemixTestOnlyPattern[];
    /**
     * Filter tests to specific playwright project(s) (--project). Accepts a single
     * project name or an array of names; `--project` may be repeated on the CLI.
     */
    project?: string | string[];
    /** Quiet mode — do not print skipped tests (--quiet, -q) */
    quiet?: boolean;
    /** Test reporter (--reporter) */
    reporter?: string;
    /**
     * Test type(s) to run (--type). Accepts a single type or an array of types;
     * `--type` may be repeated on the CLI. Valid values: "server", "browser", "e2e".
     */
    type?: string | string[];
    /** Watch mode — re-run tests on file changes (--watch) */
    watch?: boolean;
}
export interface ResolvedRemixTestConfig {
    browser: {
        echo?: boolean;
        open?: boolean;
    };
    concurrency: number;
    coverage: {
        dir: string;
        include?: string[];
        exclude?: string[];
        statements?: number;
        lines?: number;
        branches?: number;
        functions?: number;
    } | undefined;
    glob: {
        test: string[];
        browser: string[];
        e2e: string[];
        exclude: string[];
    };
    playwrightConfig: string | PlaywrightTestConfig | undefined;
    project: string[] | undefined;
    quiet: boolean;
    reporter: string;
    pool: RemixTestPool;
    only: SerializedOnlyPattern[] | undefined;
    setup: string | undefined;
    type: string[];
    watch: boolean;
}
export declare function loadConfig(invocationConfig?: RemixTestConfig, configPath?: string, cwd?: string): Promise<ResolvedRemixTestConfig>;
//# sourceMappingURL=config.d.ts.map