export interface MimeTypeDefinition {
  /** The file extension(s) to register (e.g., ['x-myformat']) */
  extensions: string | string[]
  /** The MIME type for these extensions (e.g., 'application/x-myformat') */
  mimeType: string
  /**
   * Whether this MIME type is compressible.
   * If omitted, falls back to default heuristics (text/*, +json, +text, +xml).
   */
  compressible?: boolean
  /**
   * Charset to include in Content-Type header.
   * - `'utf-8'` or other string → '; charset={value}'
   * - `undefined` → falls back to default heuristics (`'utf-8'` for `text/*`, `application/json`, `+json`)
   */
  charset?: string
}

// Custom registries - only created when defineMimeType is called.
// Exported for direct access to avoid function call overhead in hot paths.
export let customMimeTypeByExtension: Map<string, string> | undefined
export let customCompressibleByMimeType: Map<string, boolean> | undefined
export let customCharsetByMimeType: Map<string, string> | undefined

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
export function defineMimeType(definition: MimeTypeDefinition): void {
  let extensions = Array.isArray(definition.extensions)
    ? definition.extensions
    : [definition.extensions]

  customMimeTypeByExtension ??= new Map()
  for (let ext of extensions) {
    ext = ext.trim().toLowerCase()
    // Remove leading dot if present
    if (ext.startsWith('.')) {
      ext = ext.slice(1)
    }
    customMimeTypeByExtension.set(ext, definition.mimeType)
  }

  if (definition.compressible !== undefined) {
    customCompressibleByMimeType ??= new Map()
    customCompressibleByMimeType.set(definition.mimeType, definition.compressible)
  }

  if (definition.charset !== undefined) {
    customCharsetByMimeType ??= new Map()
    customCharsetByMimeType.set(definition.mimeType, definition.charset)
  }
}

// @internal - Resets all custom registrations. Used in tests for isolation.
export function resetMimeTypes(): void {
  customMimeTypeByExtension = undefined
  customCompressibleByMimeType = undefined
  customCharsetByMimeType = undefined
}
