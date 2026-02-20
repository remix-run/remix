/**
 * Base error for all `data-table` failures.
 */
export declare class DataTableError extends Error {
    code: string;
    metadata?: Record<string, unknown>;
    constructor(message: string, options?: {
        code?: string;
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
/**
 * Thrown when input data fails schema validation.
 */
export declare class DataTableValidationError extends DataTableError {
    issues: ReadonlyArray<unknown>;
    constructor(message: string, issues: ReadonlyArray<unknown>, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
/**
 * Thrown when a query is invalid for the current builder state.
 */
export declare class DataTableQueryError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
/**
 * Thrown when adapter execution fails.
 */
export declare class DataTableAdapterError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
/**
 * Thrown when a database constraint is violated.
 */
export declare class DataTableConstraintError extends DataTableError {
    constructor(message: string, options?: {
        cause?: unknown;
        metadata?: Record<string, unknown>;
    });
}
//# sourceMappingURL=errors.d.ts.map