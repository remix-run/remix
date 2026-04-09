type StyleServerCompilationErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_ALLOWED'
  | 'FILE_OUTSIDE_ROUTES'
  | 'STYLE_TRANSFORM_FAILED'
  | 'STYLE_EMIT_FAILED'
  | 'IMPORT_RESOLUTION_FAILED'
  | 'IMPORT_NOT_ALLOWED'
  | 'IMPORT_CYCLE'
  | 'ASSET_RESOLUTION_FAILED'
  | 'ASSET_NOT_ALLOWED'

export class StyleServerCompilationError extends Error {
  code: StyleServerCompilationErrorCode

  constructor(
    message: string,
    options: {
      cause?: unknown
      code: StyleServerCompilationErrorCode
    },
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'StyleServerCompilationError'
    this.code = options.code
  }
}

export function isStyleServerCompilationError(
  error: unknown,
): error is StyleServerCompilationError {
  return error instanceof StyleServerCompilationError
}

export function createStyleServerCompilationError(
  message: string,
  options: {
    cause?: unknown
    code: StyleServerCompilationErrorCode
  },
): StyleServerCompilationError {
  return new StyleServerCompilationError(message, options)
}
