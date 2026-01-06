import { customCharsetByMimeType } from './define-mime-type.ts'

/**
 * Converts a MIME type to a Content-Type header value, adding charset when appropriate.
 *
 * By default, adds `; charset=utf-8` to text-based MIME types:
 * - All `text/*` types (except `text/xml`)
 * - All `+json` suffixed types (RFC 8259 defines JSON as UTF-8)
 * - `application/json`, `application/javascript`
 *
 * Custom charset registered via `defineMimeType()` takes precedence over built-in rules.
 *
 * Note: `text/xml` is excluded because XML has built-in encoding detection.
 * Per the XML spec, documents without an encoding declaration must be UTF-8 or
 * UTF-16, detectable from byte patterns. Adding an external charset parameter
 * is redundant and can conflict with the document's internal declaration.
 *
 * @see https://www.w3.org/TR/xml/#charencoding
 *
 * @param mimeType The MIME type (e.g. "text/css", "image/png")
 * @returns The Content-Type value with charset if appropriate
 *
 * @example
 * mimeTypeToContentType('text/html')           // 'text/html; charset=utf-8'
 * mimeTypeToContentType('application/json')    // 'application/json; charset=utf-8'
 * mimeTypeToContentType('application/ld+json') // 'application/ld+json; charset=utf-8'
 * mimeTypeToContentType('image/png')           // 'image/png'
 * mimeTypeToContentType('text/xml')            // 'text/xml'
 */
export function mimeTypeToContentType(mimeType: string): string {
  // Already has charset - return as-is
  if (mimeType.includes('charset')) {
    return mimeType
  }

  // Exclude text/xml - XML has built-in encoding detection (see JSDoc above)
  if (mimeType === 'text/xml') {
    return mimeType
  }

  // Check custom charset registry
  let customCharset = customCharsetByMimeType?.get(mimeType)
  if (customCharset !== undefined) {
    return `${mimeType}; charset=${customCharset}`
  }

  // Text-based types that should have charset=utf-8
  if (
    mimeType.startsWith('text/') ||
    mimeType.endsWith('+json') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript'
  ) {
    return `${mimeType}; charset=utf-8`
  }

  return mimeType
}
