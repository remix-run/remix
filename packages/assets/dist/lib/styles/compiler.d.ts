import type { CompiledRoutes } from '../routes.ts';
import type { ResolvedStyleTarget } from '../target.ts';
import type { EmittedAsset } from './emit.ts';
type StyleCompileResult = {
    code: EmittedAsset;
    fingerprint: string | null;
    sourceMap: EmittedAsset | null;
};
type StyleGetResult = {
    style: StyleCompileResult;
    type: 'style';
} | {
    etag: string;
    type: 'not-modified';
};
type StyleGetOptions = {
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
type StyleCompilerOptions = {
    buildId?: string;
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
    targets?: ResolvedStyleTarget;
    watchIgnore?: readonly string[];
};
type StyleCompiler = {
    getHref(filePath: string): Promise<string>;
    getPreloadLayers(filePath: string | readonly string[]): Promise<string[][]>;
    getStyle(filePath: string, options: StyleGetOptions): Promise<StyleGetResult>;
    handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): Promise<void>;
};
export declare function createStyleCompiler(options: StyleCompilerOptions): StyleCompiler;
export declare function isStyleFilePath(filePath: string): boolean;
export declare function createResponseForStyle(result: StyleCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=compiler.d.ts.map