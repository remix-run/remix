export class StyleServerCompilationError extends Error {
    code;
    constructor(message, options) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'StyleServerCompilationError';
        this.code = options.code;
    }
}
export function isStyleServerCompilationError(error) {
    return error instanceof StyleServerCompilationError;
}
export function createStyleServerCompilationError(message, options) {
    return new StyleServerCompilationError(message, options);
}
