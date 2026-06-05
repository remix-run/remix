import type { PlaywrightTestConfig } from 'playwright/test';
export declare const IS_RUNNING_FROM_SRC: boolean;
export declare function getBrowserTestRootDir(): string;
/**
 * Worker pool used by `remix-test` to run server and E2E test files.
 * `'forks'` (default) uses child processes for stronger isolation; `'threads'`
 * uses worker threads for projects that prefer lower-overhead startup.
 */
export type RemixTestPool = 'forks' | 'threads';
/**
 * User-facing configuration for the `remix-test` CLI. Every field is
 * optional — unset fields fall back to runner defaults. The same shape can
 * be exported from a config file (see `--config`) or passed inline to
 * {@link runRemixTest} via the corresponding flags.
 */
export interface RemixTestConfig {
    /**
     * Options for controlling the playwright browser
     *  - `browser.echo`: Echo browser console output to stdout (--browser.echo)
     *  - `browser.open`: Open browser window and keep open after test finish (--browser.open)
     */
    browser?: {
        echo?: boolean;
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
        test?: string | string[];
        browser?: string | string[];
        e2e?: string | string[];
        exclude?: string | string[];
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Coverage configuration. `true` enables with defaults; an object enables with settings;
     * `false` disables. CLI `--coverage` flag overrides the boolean aspect.
     */
    coverage?: boolean | {
        dir?: string;
        include?: string | string[];
        exclude?: string | string[];
        statements?: number | string;
        lines?: number | string;
        branches?: number | string;
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
     * Filter tests to specific playwright project(s) (--project). Accepts a single
     * project name or an array of names; `--project` may be repeated on the CLI.
     */
    project?: string | string[];
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
    reporter: string;
    pool: RemixTestPool;
    setup: string | undefined;
    type: string[];
    watch: boolean;
}
export declare function loadConfig(args?: string[], cwd?: string): Promise<ResolvedRemixTestConfig>;
/**
 * Returns the formatted `remix-test --help` text. Useful for embedding the
 * runner's CLI options in higher-level tooling.
 *
 * @param _target Output stream the help text will be written to. Reserved
 *                for future use (e.g. width-aware formatting); currently
 *                unused.
 * @returns The help text as a single string ready to write to a stream.
 */
export declare function getRemixTestHelpText(_target?: NodeJS.WriteStream): string;
//# sourceMappingURL=config.d.ts.map