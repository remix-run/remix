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

  /**
   * @param init A string or object to initialize the header
   */
  constructor(init?: string | ContentTypeInit) {
    if (init) {
      if (typeof init === 'string') {
        let params = parseParams(init)
        if (params.length > 0) {
          this.mediaType = params[0][0]
          for (let [name, value] of params.slice(1)) {
            if (name === 'boundary') {
              this.boundary = value
            } else if (name === 'charset') {
              this.charset = value
            }
          }
        }
      } else {
        this.boundary = init.boundary
        this.charset = init.charset
        this.mediaType = init.mediaType
      }
    }
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
}
