import type { Targets } from 'lightningcss';
import { type EmittedAsset } from './emit.ts';
import type { CompiledRoutes } from './routes.ts';
export type CompiledStyleResult = {
    code: EmittedAsset;
    fingerprint: string | null;
    sourceMap: EmittedAsset | null;
};
type StyleCompilerOptions = {
    buildId?: string;
    browserslistTargets?: Targets;
    fingerprintFiles: boolean;
    isAllowed(absolutePath: string): boolean;
    minify: boolean;
    root: string;
    routes: CompiledRoutes;
    sourceMaps?: 'external' | 'inline';
};
type ParsedRequestPathname = {
    cacheControl: string;
    filePath: string;
    isSourceMapRequest: boolean;
    requestedFingerprint: string | null;
};
type StyleCompiler = {
    compileStyle(filePath: string): Promise<CompiledStyleResult>;
    getFingerprint(filePath: string): Promise<string | null>;
    getHref(filePath: string): Promise<string>;
    getPreloadUrls(filePath: string | readonly string[]): Promise<string[]>;
    handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): Promise<void>;
    isStyleFile(filePath: string): boolean;
    parseRequestPathname(pathname: string): ParsedRequestPathname | null;
};
export declare function createStyleCompiler(options: StyleCompilerOptions): StyleCompiler;
export declare function createResponseForStyle(result: CompiledStyleResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    isSourceMapRequest: boolean;
    method: string;
}): Response;
export {};
//# sourceMappingURL=compiler.d.ts.map