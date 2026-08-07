import type { CompiledRoutes } from '../routes.ts';
import type { ResolvedScriptTarget } from '../target.ts';
import type { ModuleHooks } from '../module-hooks.ts';
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
    hmr?: {
        clientPathname: string;
        send(updates: ScriptHmrUpdate[]): void;
    };
    isAllowed(absolutePath: string): boolean;
    minify: boolean;
    moduleHooks: readonly ModuleHooks[];
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
    onWatchFilesChange?: (delta: {
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
    classifyHmrFileEvent(filePath: string, event: ModuleWatchEvent): Promise<ScriptHmrUpdate[]>;
    invalidateFileEvent(filePath: string, event: ModuleWatchEvent): void;
    parseRequestPathname(pathname: string): ParsedRequestPathname | null;
};
type ParsedRequestPathname = {
    cacheControl: string;
    filePath: string;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
export type ScriptHmrUpdate = {
    accepted: false;
    filePath: string;
    path: string;
    timestamp: number;
} | {
    accepted: true;
    acceptedPath: string;
    filePath: string;
    path: string;
    timestamp: number;
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