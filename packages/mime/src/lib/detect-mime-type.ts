import { mimeTypes } from '../generated/mime-types.ts'

/**
 * Detects the MIME type for a given file extension or filename.
 *
 * @param extension - The file extension (e.g. "txt", ".txt") or filename (e.g. "file.txt")
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
  return mimeTypes[!~idx ? ext : ext.substring(++idx)]
}

