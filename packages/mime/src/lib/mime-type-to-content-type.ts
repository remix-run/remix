/**
 * Converts a MIME type to a Content-Type header value, adding charset when appropriate.
 *
 * Adds `charset=utf-8` to text-based MIME types:
 * - All `text/*` types (except `text/xml`)
 * - All `+json` suffixed types (RFC 8259 defines JSON as UTF-8)
 * - `application/json`, `application/javascript`
 *
 * Note: `text/xml` is excluded because XML has built-in encoding declarations
 * (`<?xml encoding="..."?>`) and defaults to UTF-8 per spec.
 *
 * @param mimeType - The MIME type (e.g. "text/css", "image/png")
 * @returns The Content-Type value with charset if appropriate
 *
 * @example
 * mimeTypeToContentType('text/html')           // 'text/html;charset=utf-8'
 * mimeTypeToContentType('application/json')    // 'application/json;charset=utf-8'
 * mimeTypeToContentType('application/ld+json') // 'application/ld+json;charset=utf-8'
 * mimeTypeToContentType('image/png')           // 'image/png'
 * mimeTypeToContentType('text/xml')            // 'text/xml' (no charset)
 */
export function mimeTypeToContentType(mimeType: string): string {
  // Already has charset
  if (mimeType.includes('charset')) return mimeType

  // Exclude text/xml - it has built-in encoding declarations
  if (mimeType === 'text/xml') {
    return mimeType
  }

  // Text-based types that should have charset=utf-8
  if (
    mimeType.startsWith('text/') ||
    mimeType.endsWith('+json') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript'
  ) {
    return `${mimeType};charset=utf-8`
  }

  return mimeType
}
