export interface AssetRouteDefinition {
    urlPattern: string;
    filePattern: string;
}
export interface CompiledRoutes {
    resolveUrlPathname(pathname: string): string | null;
    toUrlPathname(filePath: string): string | null;
}
export declare function compileRoutes(options: {
    fileMap: Readonly<Record<string, string>>;
    rootDir: string;
}): CompiledRoutes;
//# sourceMappingURL=routes.d.ts.map