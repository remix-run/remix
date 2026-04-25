import type { Browser, BrowserContextOptions } from 'playwright';
import type { CreateServerFunction } from './e2e-server.ts';
import type { V8CoverageEntry } from './coverage.ts';
export interface TestResult {
    name: string;
    suiteName: string;
    filePath?: string;
    status: 'passed' | 'failed' | 'skipped' | 'todo';
    error?: {
        message: string;
        stack?: string;
    };
    duration: number;
}
export interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
    tests: TestResult[];
    e2eBrowserCoverageEntries?: Array<{
        entries: V8CoverageEntry[];
        baseUrl: string;
    }>;
}
export declare function runTests(options?: {
    createServer?: CreateServerFunction;
    browser?: Browser;
    open?: boolean;
    playwrightPageOptions?: BrowserContextOptions;
    coverage?: boolean;
}): Promise<TestResults>;
//# sourceMappingURL=executor.d.ts.map