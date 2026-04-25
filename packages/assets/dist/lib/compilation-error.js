/**
 * Internal error used by the request-time module compilation pipeline.
 */
export class AssetServerCompilationError extends Error {
    code;
    constructor(message, options) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'AssetServerCompilationError';
        this.code = options.code;
    }
}
/**
 * Returns true when a value is an `AssetServerCompilationError`.
 *
 * @param error Value thrown by the compilation pipeline.
 * @returns Whether the value is an `AssetServerCompilationError`.
 */
export function isAssetServerCompilationError(error) {
    return error instanceof AssetServerCompilationError;
}
/**
 * Creates an `AssetServerCompilationError` with a stable internal code.
 *
 * @param message Human-readable error message.
 * @param options Structured internal error details.
 * @param options.cause Original error cause, when available.
 * @param options.code Stable internal compilation error code.
 * @returns A `AssetServerCompilationError`.
 */
export function createAssetServerCompilationError(message, options) {
    return new AssetServerCompilationError(message, options);
}
