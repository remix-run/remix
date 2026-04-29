import { type CoverageConfig, type CoverageMap } from './coverage.ts';
import { type PlaywrightUseOpts } from './playwright.ts';
import type { Reporter } from './reporters/index.ts';
import type { Counts } from './reporters/results.ts';
export declare function runServerTests(files: string[], reporter: Reporter, concurrency: number, type: 'server' | 'e2e', options?: {
    cwd?: string;
    open?: boolean;
    playwrightUseOpts?: PlaywrightUseOpts;
    projectName?: string;
    coverage?: CoverageConfig;
}): Promise<Counts & {
    coverageMap: CoverageMap | null;
}>;
//# sourceMappingURL=runner.d.ts.map