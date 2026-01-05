import { mimeTypes } from '../generated/mime-types.ts'
import { customMimeTypeByExtension } from './define-mime-type.ts'

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
export function detectMimeType(extension: string): string | undefined {
  let ext = extension.trim().toLowerCase()
  let idx = ext.lastIndexOf('.')
  // If no dot found (~idx === -1, so !~idx === true), use ext as-is.
  // Otherwise, skip past the dot (++idx) and extract the extension.
  // Credit to mrmime for this technique.
  ext = !~idx ? ext : ext.substring(++idx)
  return customMimeTypeByExtension?.get(ext) ?? mimeTypes[ext]
}
