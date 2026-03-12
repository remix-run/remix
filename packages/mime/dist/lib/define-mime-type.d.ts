export interface MimeTypeDefinition {
    /** The file extension(s) to register (e.g., ['x-myformat']) */
    extensions: string | string[];
    /** The MIME type for these extensions (e.g., 'application/x-myformat') */
    mimeType: string;
    /**
     * Whether this MIME type is compressible.
     * If omitted, falls back to default heuristics (text/*, +json, +text, +xml).
     */
    compressible?: boolean;
    /**
     * Charset to include in Content-Type header.
     * - `'utf-8'` or other string → '; charset={value}'
     * - `undefined` → falls back to default heuristics (`'utf-8'` for `text/*`, `application/json`, `+json`)
     */
    charset?: string;
}
export declare let customMimeTypeByExtension: Map<string, string> | undefined;
export declare let customCompressibleByMimeType: Map<string, boolean> | undefined;
export declare let customCharsetByMimeType: Map<string, string> | undefined;
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
export declare function defineMimeType(definition: MimeTypeDefinition): void;
export declare function resetMimeTypes(): void;
//# sourceMappingURL=define-mime-type.d.ts.map