import type { FileStorage } from '@remix-run/file-storage';
import type { CompiledRoutes } from '../routes.ts';
import type { AssetFileTransformResult, AssetRequestTransformMap } from './config.ts';
type EmittedFile = {
    body: Uint8Array;
    contentType: string;
    etag: string;
    extension: string;
    fingerprint: string | null;
};
type FileCompileResult = EmittedFile;
type FileGetResult = {
    etag: string;
    type: 'not-modified';
} | {
    file: FileCompileResult;
    type: 'file';
};
type FileGetOptions = {
    ifNoneMatch: string | null;
    requestedFingerprint: string | null;
    transform: readonly string[] | null;
};
type FileGetHrefOptions = {
    transform: readonly string[] | null;
};
type FileCompilerOptions<transforms extends AssetRequestTransformMap = {}> = {
    buildId?: string;
    cache?: FileStorage;
    extensions: readonly string[];
    fingerprintAssets: boolean;
    globalTransforms: readonly {
        extensions?: readonly string[];
        name?: string;
        transform(bytes: Uint8Array, context: {
            extension: string;
            filePath: string;
        }): string | Uint8Array | AssetFileTransformResult | null | Promise<string | Uint8Array | AssetFileTransformResult | null>;
    }[];
    isAllowed(absolutePath: string): boolean;
    maxRequestTransforms: number;
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
    transforms: transforms;
    rootDir: string;
    routes: CompiledRoutes;
};
export type FileCompiler = {
    getFile(filePath: string, options: FileGetOptions): Promise<FileGetResult>;
    getHref(filePath: string, options: FileGetHrefOptions): Promise<string>;
    handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): Promise<void>;
    isServedFilePath(filePath: string): boolean;
    validateTransformQuery(transformQuery: readonly string[]): void;
};
type ResolveArgs = {
    extensions: ReadonlySet<string>;
    isAllowed(absolutePath: string): boolean;
    routes: CompiledRoutes;
};
type ResolvedFile = {
    identityPath: string;
    stableUrlPathname: string;
};
export declare function createFileCompiler<transforms extends AssetRequestTransformMap>(options: FileCompilerOptions<transforms>): FileCompiler;
export declare function resolveServedFileOrThrow(filePath: string, args: ResolveArgs): ResolvedFile;
export declare function createResponseForFile(result: FileCompileResult, options: {
    cacheControl: string;
    ifNoneMatch: string | null;
    method: string;
}): Response;
export declare function isServedFilePath(filePath: string, extensions: ReadonlySet<string>): boolean;
export {};
//# sourceMappingURL=compiler.d.ts.map