import type { PlaywrightTestConfig } from 'playwright/test';
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
     * Glob patterns to identify test files
     *  - `glob.test`: Glob pattern for all test files (--glob.test)
     *  - `glob.e2e`: Glob pattern for the subset of e2e test files (--glob.e2e)
     *  - `glob.exclude`: Glob pattern for paths to exclude from discovery (--glob.exclude)
     */
    glob?: {
        test?: string;
        e2e?: string;
        exclude?: string;
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Coverage configuration. `true` enables with defaults; an object enables with settings;
     * `false` disables. CLI `--coverage` flag overrides the boolean aspect.
     */
    coverage?: boolean | {
        dir?: string;
        include?: string[];
        exclude?: string[];
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
    /** Filter tests to a specific playwright project or comma-separated list of projects (--project) */
    project?: string;
    /** Test reporter (--reporter) */
    reporter?: string;
    /** Comma-separated list of test types to run (--type) */
    type?: string;
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
        test: string;
        e2e: string;
        exclude: string;
    };
    playwrightConfig: string | PlaywrightTestConfig | undefined;
    project: string | undefined;
    reporter: string;
    setup: string | undefined;
    type: string;
    watch: boolean;
}
export declare function loadConfig(): Promise<ResolvedRemixTestConfig>;
//# sourceMappingURL=config.d.ts.map