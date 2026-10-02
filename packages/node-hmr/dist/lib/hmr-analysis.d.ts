export interface NodeHmrAnalysis {
    acceptedDeps: NodeHmrAcceptedDependency[];
    selfAccepting: boolean;
    usesImportMetaHot: boolean;
}
export interface ResolvedNodeHmrAnalysis {
    acceptedDeps: string[];
    selfAccepting: boolean;
    usesImportMetaHot: boolean;
}
export interface NodeHmrAcceptedDependency {
    end: number;
    specifier: string;
    start: number;
}
export declare function analyzeNodeHmrSource(importerUrl: string, source: string): NodeHmrAnalysis;
//# sourceMappingURL=hmr-analysis.d.ts.map