import { compressibleMimeTypes } from '../generated/compressible-mime-types.ts'

/**
 * Checks if a MIME type is known to be compressible.
 *
 * Returns true for:
 * - Compressible MIME types from mime-db, except for types starting with `x-` (experimental) or `vnd.` (vendor-specific).
 * - Any text/* type
 * - Types with +json, +text, or +xml suffix
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

  if (compressibleMimeTypes.has(type)) {
    return true
  }

  return genericCompressibleRegex.test(type)
}

// Check for text/*, or anything with +json, +text, or +xml suffix
const genericCompressibleRegex = /^text\/|\+(?:json|text|xml)$/i
