type AssetServerCompilationErrorCode = 'MODULE_NOT_FOUND' | 'MODULE_NOT_ALLOWED' | 'MODULE_OUTSIDE_FILE_MAP' | 'MODULE_COMMONJS_NOT_SUPPORTED' | 'MODULE_TRANSFORM_FAILED' | 'MODULE_EMIT_FAILED' | 'IMPORT_RESOLUTION_FAILED' | 'IMPORT_NOT_SUPPORTED' | 'IMPORT_NOT_ALLOWED' | 'IMPORT_OUTSIDE_FILE_MAP';
/**
 * Internal error used by the request-time module compilation pipeline.
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