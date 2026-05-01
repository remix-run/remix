import { type PlaywrightUseOpts } from './playwright.ts';
import type { CoverageConfig } from './coverage.ts';
import type { TestResults } from './reporters/results.ts';
export interface E2ETestWorkerData {
    file: string;
    coverage?: CoverageConfig;
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
}
export declare function runE2ETestFile(value: unknown, onOpenResults?: (results: TestResults) => void | Promise<void>): Promise<TestResults | undefined>;
//# sourceMappingURL=worker-e2e-file.d.ts.map