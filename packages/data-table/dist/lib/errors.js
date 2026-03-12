/**
 * Base error for all `data-table` failures.
 */
export class DataTableError extends Error {
    code;
    metadata;
    constructor(message, options) {
        super(message, { cause: options?.cause });
        this.name = 'DataTableError';
        this.code = options?.code ?? 'DATA_TABLE_ERROR';
        this.metadata = options?.metadata;
    }
}
/**
 * Thrown when input data fails schema validation.
 */
export class DataTableValidationError extends DataTableError {
    issues;
    constructor(message, issues, options) {
        super(message, {
            code: 'DATA_TABLE_VALIDATION_ERROR',
            cause: options?.cause,
            metadata: options?.metadata,
        });
        this.name = 'DataTableValidationError';
        this.issues = issues;
    }
}
/**
 * Thrown when a query is invalid for the current builder state.
 */
export class DataTableQueryError extends DataTableError {
    constructor(message, options) {
        super(message, {
            code: 'DATA_TABLE_QUERY_ERROR',
            cause: options?.cause,
            metadata: options?.metadata,
        });
        this.name = 'DataTableQueryError';
    }
}
/**
 * Thrown when adapter execution fails.
 */
export class DataTableAdapterError extends DataTableError {
    constructor(message, options) {
        super(message, {
            code: 'DATA_TABLE_ADAPTER_ERROR',
            cause: options?.cause,
            metadata: options?.metadata,
        });
        this.name = 'DataTableAdapterError';
    }
}
/**
 * Thrown when a database constraint is violated.
 */
export class DataTableConstraintError extends DataTableError {
    constructor(message, options) {
        super(message, {
            code: 'DATA_TABLE_CONSTRAINT_ERROR',
            cause: options?.cause,
            metadata: options?.metadata,
        });
        this.name = 'DataTableConstraintError';
    }
}
