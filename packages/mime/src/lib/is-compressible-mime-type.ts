import { compressibleMimeTypes } from '../generated/compressible-mime-types.ts'

/**
 * Checks if a MIME type is known to be compressible.
 *
 * Returns true for:
 * - Compressible MIME types from mime-db, except for types starting with `x-` (experimental) or `vnd.` (vendor-specific).
 * - Any text/* type
 * - Types with +json, +text, or +xml suffix
 *
 * @param mimeType The MIME type to check (e.g. "application/json")
 * @returns true if the MIME type is known to be compressible
 */
export function isCompressibleMimeType(mimeType: string): boolean {
  if (!mimeType) return false

  if (compressibleMimeTypes.has(mimeType)) {
    return true
  }

  return genericCompressibleRegex.test(mimeType)
}

// Check for text/*, or anything with +json, +text, or +xml suffix
const genericCompressibleRegex = /^text\/|\+(?:json|text|xml)$/i

