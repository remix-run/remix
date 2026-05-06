import { type RemixTestPool } from './config.ts';
import { type CoverageConfig, type CoverageMap } from './coverage.ts';
import { type PlaywrightUseOpts } from './playwright.ts';
import type { Reporter } from './reporters/index.ts';
import type { Counts, TestResults } from './reporters/results.ts';
interface WorkerRun {
    finished: Promise<void>;
    exited: Promise<number | null>;
    terminate(): Promise<boolean>;
}
interface RunFileOptions {
    cwd?: string;
    coverage?: CoverageConfig;
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
    pool?: RemixTestPool;
}
export declare function runServerTests(files: string[], reporter: Reporter, concurrency: number, type: 'server' | 'e2e', options?: {
    cwd?: string;
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
    projectName?: string;
    coverage?: CoverageConfig;
    workerShutdownTimeoutMs?: number;
    pool?: RemixTestPool;
}): Promise<Counts & {
    coverageMap: CoverageMap | null;
}>;
export declare function runFileInWorker(file: string, type: 'server' | 'e2e', onResults: (results: TestResults) => void, options?: RunFileOptions): WorkerRun;
export {};
//# sourceMappingURL=runner.d.ts.map