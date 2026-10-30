import { type HeaderValue } from './header-value.ts'
import { parseParams, quote } from './param-values.ts'

/**
 * Initializer for a `Content-Disposition` header value.
 */
export interface ContentDispositionInit {
  /**
   * The suggested filename for the content. Values received from clients are untrusted metadata
   * and must not be used directly as filesystem paths.
   */
  filename?: string
  /**
   * The suggested filename encoded as an [RFC 8187](https://tools.ietf.org/html/rfc8187) `filename*` parameter.
   * Values received from clients are untrusted metadata, even after decoding, and must not be
   * used directly as filesystem paths.
   */
  filenameSplat?: string
  /**
   * For `multipart/form-data` requests, the name of the `<input>` field associated with this content.
   */
  name?: string
  /**
   * The disposition type of the content, such as `attachment` or `inline`.
   */
  type?: string
}

/**
 * The value of a `Content-Disposition` HTTP header.
 *
 * [MDN `Content-Disposition` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
 *
 * [RFC 6266](https://tools.ietf.org/html/rfc6266)
 */
export class ContentDisposition implements HeaderValue, ContentDispositionInit {
  /**
   * The `filename` parameter value. Values received from clients are untrusted metadata;
   * no filesystem sanitization is applied. Do not use this value directly as a filesystem path.
   */
  filename?: string

  /**
   * The RFC 8187-encoded `filename*` parameter value. Values received from clients are untrusted
   * metadata, even after decoding. Do not use this value directly as a filesystem path.
   */
  filenameSplat?: string

  /**
   * The associated multipart field name.
   */
  name?: string

  /**
   * The disposition type such as `attachment` or `inline`.
   */
  type?: string

  constructor(init?: string | ContentDispositionInit) {
    if (init) return ContentDisposition.from(init)
  }

  /**
   * The preferred filename for the content, using the decoded `filename*` parameter when available,
   * falling back to the `filename` parameter, as described in [RFC 6266](https://tools.ietf.org/html/rfc6266).
   *
   * This selects and decodes metadata without sanitizing it for filesystem use. Values received
   * from clients are untrusted input and must not be used directly as filesystem paths. Generate
   * a storage name in your application instead.
   */
  get preferredFilename(): string | undefined {
    let filenameSplat = this.filenameSplat
    if (filenameSplat) {
      let decodedFilename = decodeFilenameSplat(filenameSplat)
      if (decodedFilename) return decodedFilename
    }

    return this.filename
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    if (!this.type) {
      return ''
    }

    let parts = [this.type]

    if (this.name) {
      parts.push(`name=${quote(this.name)}`)
    }
    if (this.filename) {
      parts.push(`filename=${quote(this.filename)}`)
    }
    if (this.filenameSplat) {
      parts.push(`filename*=${quote(this.filenameSplat)}`)
    }

    return parts.join('; ')
  }

  /**
   * Parse a Content-Disposition header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns A ContentDisposition instance (empty if null)
   */
  static from(value: string | ContentDispositionInit | null): ContentDisposition {
    let header = new ContentDisposition()

    if (value !== null) {
      if (typeof value === 'string') {
        let params = parseParams(value)
        if (params.length > 0) {
          header.type = params[0][0]
          for (let [name, val] of params.slice(1)) {
            if (name === 'filename') {
              header.filename = val
            } else if (name === 'filename*') {
              header.filenameSplat = val
            } else if (name === 'name') {
              header.name = val
            }
          }
        }
      } else {
        header.filename = value.filename
        header.filenameSplat = value.filenameSplat
        header.name = value.name
        header.type = value.type
      }
    }

    return header
  }
}

function decodeFilenameSplat(value: string): string | null {
  let match = value.match(/^([\w-]+)'([^']*)'(.+)$/)
  if (!match) return null

  let [, charset, , encodedFilename] = match

  let decodedFilename = percentDecode(encodedFilename)

  try {
    let decoder = new TextDecoder(charset)
    let bytes = new Uint8Array(decodedFilename.split('').map((char) => char.charCodeAt(0)))
    return decoder.decode(bytes)
  } catch (error) {
    console.warn(`Failed to decode filename from charset ${charset}:`, error)
    return decodedFilename
  }
}

function percentDecode(value: string): string {
  return value.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}
