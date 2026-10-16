import type { createCoverageMap as CreateCoverageMap } from 'istanbul-lib-coverage';
export interface CoverageConfig {
    dir: string;
    include?: string[];
    exclude?: string[];
    statements?: number;
    lines?: number;
    branches?: number;
    functions?: number;
}
export interface V8CoverageEntry {
    url: string;
    source?: string;
    functions: Array<{
        functionName: string;
        isBlockCoverage: boolean;
        ranges: Array<{
            startOffset: number;
            endOffset: number;
            count: number;
        }>;
    }>;
}
export type CoverageMap = ReturnType<typeof CreateCoverageMap>;
export declare function collectServerCoverageMap(coverageDataDir: string, cwd: string, testFiles: Set<string>): Promise<CoverageMap | null>;
export declare function collectCoverageMapFromPlaywright(entries: V8CoverageEntry[], rootDir: string, testFiles: Set<string>, resolveRelativePath: (url: string) => Promise<string | null>): Promise<CoverageMap | null>;
export declare function generateCombinedCoverageReport(maps: (CoverageMap | null | undefined)[], cwd: string, config: CoverageConfig): Promise<boolean>;
//# sourceMappingURL=coverage.d.ts.map