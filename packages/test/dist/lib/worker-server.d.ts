import { type SerializedOnlyPattern } from './config.ts';
import type { CoverageConfig } from './coverage.ts';
import type { TestResults } from './reporters/results.ts';
export interface ServerTestWorkerData {
    file: string;
    coverage?: CoverageConfig;
    only?: SerializedOnlyPattern[];
}
export declare function runServerTestFile(value: unknown): Promise<TestResults>;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function parseCoverageConfig(value: unknown): CoverageConfig | undefined;
export declare function parseOnlyPatterns(value: unknown): SerializedOnlyPattern[] | undefined;
//# sourceMappingURL=worker-server.d.ts.map