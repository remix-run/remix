interface RouteConfig {
    fileMap: Readonly<Record<string, string>>;
    rootDir: string;
}
export interface CompiledRoutes {
    resolveUrlPathname(pathname: string): string | null;
    matchUrlPathname(pathname: string): AssetRouteMatch | null;
    toUrlPathname(filePath: string): string | null;
    matchFilePath(filePath: string): AssetRouteMatch | null;
}
export interface AssetRouteMatch {
    filePath: string;
    filePattern: string;
    urlPathname: string;
    urlPattern: string;
}
export declare function compileRoutes(basePath: string, routeConfigs: readonly RouteConfig[]): CompiledRoutes;
export {};
//# sourceMappingURL=routes.d.ts.map