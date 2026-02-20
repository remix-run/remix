/**
 * Detects the MIME type for a given file extension or filename.
 *
 * Custom MIME types registered via `defineMimeType()` take precedence over built-in types.
 *
 * @param extension The file extension (e.g. "txt", ".txt") or filename (e.g. "file.txt")
 * @returns The MIME type string, or undefined if not found
 *
 * @example
 * detectMimeType('txt')           // 'text/plain'
 * detectMimeType('.txt')          // 'text/plain'
 * detectMimeType('file.txt')      // 'text/plain'
 * detectMimeType('unknown')       // undefined
 */
export declare function detectMimeType(extension: string): string | undefined;
//# sourceMappingURL=detect-mime-type.d.ts.map