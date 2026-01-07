import { compressibleMimeTypes } from '../generated/compressible-mime-types.ts'
import { customCompressibleByMimeType } from './define-mime-type.ts'

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
export function isCompressibleMimeType(mimeType: string): boolean {
  if (!mimeType) return false

  // Extract MIME type from Content-Type header if it includes parameters
  let idx = mimeType.indexOf(';')
  let type = ~idx ? mimeType.substring(0, idx).trim() : mimeType

  let customCompressible = customCompressibleByMimeType?.get(type)
  if (customCompressible !== undefined) {
    return customCompressible
  }

  if (compressibleMimeTypes.has(type)) {
    return true
  }

  return genericCompressibleMimeTypeRegex.test(type)
}

// Check for text/*, or anything with +json, +text, or +xml suffix
// Exported for use in codegen to filter redundant entries from compressible-mime-types.ts.
export const genericCompressibleMimeTypeRegex = /^text\/|\+(?:json|text|xml)$/i
