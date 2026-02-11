export declare class DataTableError extends Error {
    code: string;
    metadata?: Record<string, unknown>;
    constructor(message: string, options?: {
        code?: string;
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
export declare class DataTableValidationError extends DataTableError {
    issues: ReadonlyArray<unknown>;
    constructor(message: string, issues: ReadonlyArray<unknown>, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
export declare class DataTableQueryError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
export declare class DataTableAdapterError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
export declare class DataTableConstraintError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
//# sourceMappingURL=errors.d.ts.map