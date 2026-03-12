export interface ResolvedScriptRoot {
    prefix: string | null;
    directory: string;
}
interface ResolvedRootMatch<root extends ResolvedScriptRoot = ResolvedScriptRoot> {
    resolvedRoot: root;
    relativePath: string;
    publicPath: string;
}
export declare function normalizeRootPrefix(prefix?: string): string | null;
export declare function resolveAbsolutePathFromResolvedRoots<root extends ResolvedScriptRoot>(absolutePath: string, roots: readonly root[]): ResolvedRootMatch<root> | null;
export declare function resolvePublicPathFromResolvedRoots<root extends ResolvedScriptRoot>(publicPath: string, roots: readonly root[]): ResolvedRootMatch<root> | null;
export {};
//# sourceMappingURL=path-utils.d.ts.map