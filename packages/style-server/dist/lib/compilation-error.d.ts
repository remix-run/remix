type StyleServerCompilationErrorCode = 'FILE_NOT_FOUND' | 'FILE_NOT_ALLOWED' | 'FILE_OUTSIDE_ROUTES' | 'STYLE_TRANSFORM_FAILED' | 'STYLE_EMIT_FAILED' | 'IMPORT_RESOLUTION_FAILED' | 'IMPORT_NOT_ALLOWED' | 'IMPORT_CYCLE' | 'ASSET_RESOLUTION_FAILED' | 'ASSET_NOT_ALLOWED';
export declare class StyleServerCompilationError extends Error {
    code: StyleServerCompilationErrorCode;
    constructor(message: string, options: {
        cause?: unknown;
        code: StyleServerCompilationErrorCode;
    });
}
export declare function isStyleServerCompilationError(error: unknown): error is StyleServerCompilationError;
export declare function createStyleServerCompilationError(message: string, options: {
    cause?: unknown;
    code: StyleServerCompilationErrorCode;
}): StyleServerCompilationError;
export {};
//# sourceMappingURL=compilation-error.d.ts.map