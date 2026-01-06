import { type HeaderValue } from './header-value.ts'
import { parseParams, quote } from './param-values.ts'

/**
 * Initializer for a `Content-Type` header value.
 */
export interface ContentTypeInit {
  /**
   * For multipart entities, the boundary that separates the different parts of the message.
   */
  boundary?: string
  /**
   * Indicates the [character encoding](https://developer.mozilla.org/en-US/docs/Glossary/Character_encoding) of the content.
   *
   * For example, `utf-8`, `iso-8859-1`.
   */
  charset?: string
  /**
   * The media type (or MIME type) of the content. This consists of a type and subtype, separated by a slash.
   *
   * For example, `text/html`, `application/json`, `image/png`.
   *
   * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)
   */
  mediaType?: string
}

/**
 * The value of a `Content-Type` HTTP header.
 *
 * [MDN `Content-Type` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type)
 *
 * [HTTP/1.1 Specification](https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.5)
 */
export class ContentType implements HeaderValue, ContentTypeInit {
  boundary?: string
  charset?: string
  mediaType?: string

  constructor(init?: string | ContentTypeInit) {
    if (init) return ContentType.from(init)
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    if (!this.mediaType) {
      return ''
    }

    let parts = [this.mediaType]

    if (this.charset) {
      parts.push(`charset=${quote(this.charset)}`)
    }
    if (this.boundary) {
      parts.push(`boundary=${quote(this.boundary)}`)
    }

    return parts.join('; ')
  }

  /**
   * Parse a Content-Type header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns A ContentType instance (empty if null)
   */
  static from(value: string | ContentTypeInit | null): ContentType {
    let header = new ContentType()

    if (value !== null) {
      if (typeof value === 'string') {
        let params = parseParams(value)
        if (params.length > 0) {
          header.mediaType = params[0][0]
          for (let [name, val] of params.slice(1)) {
            if (name === 'boundary') {
              header.boundary = val
            } else if (name === 'charset') {
              header.charset = val
            }
          }
        }
      } else {
        header.boundary = value.boundary
        header.charset = value.charset
        header.mediaType = value.mediaType
      }
    }

    return header
  }
}
