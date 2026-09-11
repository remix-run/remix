// Custom registries - only created when defineMimeType is called.
// Exported for direct access to avoid function call overhead in hot paths.
export let customMimeTypeByExtension;
export let customCompressibleByMimeType;
export let customCharsetByMimeType;
/**
 * Registers a custom MIME type for one or more file extensions.
 *
 * Use this to add support for file extensions not included in the defaults,
 * or to override the behavior of existing extensions.
 *
 * @param definition The MIME type definition to register
 *
 * @example
 * defineMimeType({
 *   extensions: ['x-myformat'],
 *   mimeType: 'application/x-myformat',
 * })
 *
 * @example
 * // Configure compressibility and charset
 * defineMimeType({
 *   extensions: ['x-myformat'],
 *   mimeType: 'application/x-myformat',
 *   compressible: true, // Optional
 *   charset: 'utf-8', // Optional
 * })
 */
export function defineMimeType(definition) {
    let extensions = Array.isArray(definition.extensions)
        ? definition.extensions
        : [definition.extensions];
    customMimeTypeByExtension ??= new Map();
    for (let ext of extensions) {
        ext = ext.trim().toLowerCase();
        // Remove leading dot if present
        if (ext.startsWith('.')) {
            ext = ext.slice(1);
        }
        customMimeTypeByExtension.set(ext, definition.mimeType);
    }
    if (definition.compressible !== undefined) {
        customCompressibleByMimeType ??= new Map();
        customCompressibleByMimeType.set(definition.mimeType, definition.compressible);
    }
    if (definition.charset !== undefined) {
        customCharsetByMimeType ??= new Map();
        customCharsetByMimeType.set(definition.mimeType, definition.charset);
    }
}
// @internal - Resets all custom registrations. Used in tests for isolation.
export function resetMimeTypes() {
    customMimeTypeByExtension = undefined;
    customCompressibleByMimeType = undefined;
    customCharsetByMimeType = undefined;
}
