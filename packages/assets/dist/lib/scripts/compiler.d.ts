import type { CompiledRoutes } from '../routes.ts';
import type { ScriptsTarget } from '../asset-server.ts';
import type { EmittedAsset } from './emit.ts';
type ModuleCompileResult = {
    code: EmittedAsset;
    fingerprint: string | null;
    sourceMap: EmittedAsset | null;
};
type ModuleGetResult = {
    type: 'module';
    module: ModuleCompileResult;
} | {
    type: 'not-modified';
    etag: string;
};
type ModuleGetOptions = {
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
type ModuleCompilerOptions = {
    buildId?: string;
    define?: Record<string, string>;
    external: string[];
    fingerprintModules: boolean;
    isAllowed(absolutePath: string): boolean;
    minify: boolean;
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
    rootDir: string;
    routes: CompiledRoutes;
    sourceMapSourcePaths: 'absolute' | 'url';
    sourceMaps?: 'external' | 'inline';
    target?: ScriptsTarget;
    watchIgnore?: readonly string[];
    watchMode: boolean;
};
type ModuleWatchEvent = 'add' | 'change' | 'unlink';
type ModuleCompiler = {
    getModule(filePath: string, options: ModuleGetOptions): Promise<ModuleGetResult>;
    getPreloadUrls(filePath: string | readonly string[]): Promise<string[]>;
    getHref(filePath: string): Promise<string>;
    handleFileEvent(filePath: string, event: ModuleWatchEvent): Promise<void>;
    parseRequestPathname(pathname: string): ParsedRequestPathname | null;
};
type ParsedRequestPathname = {
    cacheControl: string;
    filePath: string;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
export declare function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler;
export declare function createResponseForModule(result: ModuleCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=compiler.d.ts.map