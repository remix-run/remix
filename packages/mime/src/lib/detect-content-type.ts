import { detectMimeType } from './detect-mime-type.ts'
import { mimeTypeToContentType } from './mime-type-to-content-type.ts'

/**
 * Detects the Content-Type header value for a given file extension or filename.
 *
 * Returns a full Content-Type value including charset when appropriate, based on
 * the charset defined in mime-db for the detected MIME type.
 *
 * @param extension The file extension (e.g. "css", ".css") or filename (e.g. "style.css")
 * @returns The Content-Type value, or undefined if not found
 *
 * @example
 * detectContentType('css')           // 'text/css;charset=utf-8'
 * detectContentType('.css')          // 'text/css;charset=utf-8'
 * detectContentType('style.css')     // 'text/css;charset=utf-8'
 * detectContentType('image.png')     // 'image/png'
 * detectContentType('unknown')       // undefined
 */
export function detectContentType(extension: string): string | undefined {
  let mimeType = detectMimeType(extension)
  return mimeType ? mimeTypeToContentType(mimeType) : undefined
}
