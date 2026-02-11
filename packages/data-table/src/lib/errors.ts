export class DataTableError extends Error {
  code: string
  metadata?: Record<string, unknown>

  constructor(
    message: string,
    options?: {
      code?: string
      cause?: unknown
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'DataTableError'
    this.code = options?.code ?? 'DATA_TABLE_ERROR'
    this.metadata = options?.metadata
  }
}

export class DataTableValidationError extends DataTableError {
  issues: ReadonlyArray<unknown>

  constructor(
    message: string,
    issues: ReadonlyArray<unknown>,
    options?: {
      cause?: unknown
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, {
      code: 'DATA_TABLE_VALIDATION_ERROR',
      cause: options?.cause,
      metadata: options?.metadata,
    })

    this.name = 'DataTableValidationError'
    this.issues = issues
  }
}

export class DataTableQueryError extends DataTableError {
  constructor(
    message: string,
    options?: {
      cause?: unknown
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, {
      code: 'DATA_TABLE_QUERY_ERROR',
      cause: options?.cause,
      metadata: options?.metadata,
    })

    this.name = 'DataTableQueryError'
  }
}

export class DataTableAdapterError extends DataTableError {
  constructor(
    message: string,
    options?: {
      cause?: unknown
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, {
      code: 'DATA_TABLE_ADAPTER_ERROR',
      cause: options?.cause,
      metadata: options?.metadata,
    })

    this.name = 'DataTableAdapterError'
  }
}

export class DataTableConstraintError extends DataTableError {
  constructor(
    message: string,
    options?: {
      cause?: unknown
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, {
      code: 'DATA_TABLE_CONSTRAINT_ERROR',
      cause: options?.cause,
      metadata: options?.metadata,
    })

    this.name = 'DataTableConstraintError'
  }
}
