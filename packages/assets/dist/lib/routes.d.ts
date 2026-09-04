interface MountConfig {
    mounts: Readonly<Record<string, string>>;
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
    fileRoot: string;
    urlPathname: string;
    urlRoot: string;
}
export declare function compileRoutes(basePath: string, mountConfigs: readonly MountConfig[]): CompiledRoutes;
export {};
//# sourceMappingURL=routes.d.ts.map