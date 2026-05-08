import type { CompiledRoutes } from '../routes.ts';
import type { ResolvedScriptTarget } from '../target.ts';
import type { ModuleWatchEvent } from '../module-store.ts';
import type { EmittedAsset } from './emit.ts';
type ScriptCompileResult = {
    code: EmittedAsset;
    fingerprint: string | null;
    sourceMap: EmittedAsset | null;
};
type ScriptGetResult = {
    script: ScriptCompileResult;
    type: 'script';
} | {
    type: 'not-modified';
    etag: string;
};
type ScriptGetOptions = {
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
type ScriptCompilerOptions = {
    buildId?: string;
    define?: Record<string, string>;
    external: string[];
    fingerprintAssets: boolean;
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
    target?: ResolvedScriptTarget;
    watchIgnore?: readonly string[];
    watchMode: boolean;
};
type ScriptCompiler = {
    getScript(filePath: string, options: ScriptGetOptions): Promise<ScriptGetResult>;
    getPreloadLayers(filePath: string | readonly string[]): Promise<string[][]>;
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
export declare function createScriptCompiler(options: ScriptCompilerOptions): ScriptCompiler;
export declare function createResponseForScript(result: ScriptCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=compiler.d.ts.map