import { type CoverageMap } from './coverage.ts';
import { type PlaywrightUseOpts } from './playwright.ts';
import type { Reporter } from './reporters/index.ts';
import type { TestResults } from './reporters/results.ts';
export interface TestRunOptions {
    baseUrl: string;
    console?: boolean;
    coverage?: boolean;
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
    projectName?: string;
    reporter: Reporter;
    testFiles?: string[];
}
export declare function runBrowserTests(options: TestRunOptions): Promise<{
    results: TestResults;
    coverageMap: CoverageMap | null;
    close: () => Promise<void>;
    disconnected: Promise<void>;
}>;
//# sourceMappingURL=runner-browser.d.ts.map