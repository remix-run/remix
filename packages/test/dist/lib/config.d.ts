export declare const defaultTestGlob = "**/*.test?(.browser)?(.e2e).{ts,tsx}";
export interface RemixTestConfig {
    /**
     * Glob patterns to identify test files
     *  - `glob.test`: Glob pattern for all test files (--glob.test)
     */
    glob?: {
        test?: string;
    };
    /** Max number of concurrent test workers (--concurrency) */
    concurrency?: number | string;
    /**
     * Path to a module that exports `globalSetup` and/or `globalTeardown` functions,
     * called once before and after the test run respectively. (--setup)
     */
    setup?: string;
    /** Test reporter (--reporter) */
    reporter?: string;
    /** Watch mode — re-run tests on file changes (--watch) */
    watch?: boolean;
}
export interface ResolvedRemixTestConfig {
    concurrency: number;
    glob: {
        test: string;
    };
    setup?: string;
    reporter: string;
    watch?: boolean;
}
export declare function loadConfig(): Promise<ResolvedRemixTestConfig>;
//# sourceMappingURL=config.d.ts.map