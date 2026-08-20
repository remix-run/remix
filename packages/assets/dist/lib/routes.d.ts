interface MountConfig {
    mounts: Readonly<Record<string, string>>;
    rootDir: string;
}
export interface CompiledRoutes {
    resolveUrlPathname(pathname: string): string | null;
    toUrlPathname(filePath: string): string | null;
}
export declare function compileRoutes(basePath: string, mountConfigs: readonly MountConfig[]): CompiledRoutes;
export {};
//# sourceMappingURL=routes.d.ts.map