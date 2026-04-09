export interface StyleRouteDefinition {
    urlPattern: string;
    filePattern: string;
}
export interface CompiledRoutes {
    resolveUrlPathname(pathname: string): string | null;
    toUrlPathname(filePath: string): string | null;
}
export declare function compileRoutes(options: {
    routes: readonly StyleRouteDefinition[];
    root: string;
}): CompiledRoutes;
//# sourceMappingURL=routes.d.ts.map