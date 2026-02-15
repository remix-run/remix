/**
 * Checks if a MIME type is known to be compressible.
 *
 * Returns true for:
 * - Compressible MIME types from mime-db
 * - Any text/* type
 * - Types with +json, +text, or +xml suffix
 * - MIME types explicitly registered as compressible via `defineMimeType()`
 *
 * Accepts either a bare MIME type or a full Content-Type header value with parameters.
 *
 * @param mimeType The MIME type to check (e.g. "application/json" or "text/html; charset=utf-8")
 * @returns true if the MIME type is known to be compressible
 */
export declare function isCompressibleMimeType(mimeType: string): boolean;
export declare const genericCompressibleMimeTypeRegex: RegExp;
//# sourceMappingURL=is-compressible-mime-type.d.ts.map