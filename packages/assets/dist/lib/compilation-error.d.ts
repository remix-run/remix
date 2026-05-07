type AssetServerCompilationErrorCode = 'FILE_NOT_FOUND' | 'FILE_NOT_ALLOWED' | 'FILE_NOT_SUPPORTED' | 'FILE_OUTSIDE_FILE_MAP' | 'INVALID_TRANSFORM_QUERY' | 'COMMONJS_NOT_SUPPORTED' | 'TRANSFORM_FAILED' | 'EMIT_FAILED' | 'IMPORT_RESOLUTION_FAILED' | 'IMPORT_NOT_SUPPORTED' | 'IMPORT_NOT_ALLOWED' | 'IMPORT_OUTSIDE_FILE_MAP' | 'URL_RESOLUTION_FAILED' | 'URL_NOT_SUPPORTED' | 'URL_NOT_ALLOWED' | 'URL_OUTSIDE_FILE_MAP';
/**
 * Internal error used by the request-time asset compilation pipeline.
 */
export declare class AssetServerCompilationError extends Error {
    code: AssetServerCompilationErrorCode;
    constructor(message: string, options: {
        cause?: unknown;
        code: AssetServerCompilationErrorCode;
    });
}
/**
 * Returns true when a value is an `AssetServerCompilationError`.
 *
 * @param error Value thrown by the compilation pipeline.
 * @returns Whether the value is an `AssetServerCompilationError`.
 */
export declare function isAssetServerCompilationError(error: unknown): error is AssetServerCompilationError;
/**
 * Creates an `AssetServerCompilationError` with a stable internal code.
 *
 * @param message Human-readable error message.
 * @param options Structured internal error details.
 * @param options.cause Original error cause, when available.
 * @param options.code Stable internal compilation error code.
 * @returns A `AssetServerCompilationError`.
 */
export declare function createAssetServerCompilationError(message: string, options: {
    cause?: unknown;
    code: AssetServerCompilationErrorCode;
}): AssetServerCompilationError;
export {};
//# sourceMappingURL=compilation-error.d.ts.map