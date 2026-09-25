type SourceMapOffsetMapping = {
    generatedOffset: number;
    originalOffset: number;
    name?: string;
};
export declare function replaceSourceMapMappings(sourceMap: string, generatedSource: string, originalSource: string, replacements: readonly SourceMapOffsetMapping[]): string;
export declare function composeSourceMaps(rewriteSourceMap: string, transformSourceMap: string): string;
export declare function rewriteSourceMapSources(sourceMap: string, resolvedPath: string, stableUrlPathname: string, sourceMapSourcePaths: 'absolute' | 'url', sourceContent?: string): string;
export declare function stringifySourceMap(map: unknown): string | null;
export {};
//# sourceMappingURL=source-maps.d.ts.map