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
