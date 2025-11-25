import { type HeaderValue } from './header-value.ts'

/**
 * Initializer for a `Content-Range` header value.
 */
export interface ContentRangeInit {
  /**
   * The unit of the range, typically "bytes"
   */
  unit?: string
  /**
   * The start position of the range (inclusive)
   * Set to null for unsatisfied ranges
   */
  start?: number | null
  /**
   * The end position of the range (inclusive)
   * Set to null for unsatisfied ranges
   */
  end?: number | null
  /**
   * The total size of the resource
   * Set to '*' for unknown size
   */
  size?: number | '*'
}

/**
 * The value of a `Content-Range` HTTP header.
 *
 * [MDN `Content-Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.content-range)
 */
export class ContentRange implements HeaderValue, ContentRangeInit {
  unit: string = ''
  start: number | null = null
  end: number | null = null
  size?: number | '*'

  /**
   * @param init A string or object to initialize the header
   */
  constructor(init?: string | ContentRangeInit) {
    if (init) {
      if (typeof init === 'string') {
        // Parse: "bytes 200-1000/67589" or "bytes */67589" or "bytes 200-1000/*"
        let match = init.match(/^(\w+)\s+(?:(\d+)-(\d+)|\*)\/((?:\d+|\*))$/)
        if (match) {
          this.unit = match[1]
          this.start = match[2] ? parseInt(match[2], 10) : null
          this.end = match[3] ? parseInt(match[3], 10) : null
          this.size = match[4] === '*' ? '*' : parseInt(match[4], 10)
        }
      } else {
        if (init.unit !== undefined) this.unit = init.unit
        if (init.start !== undefined) this.start = init.start
        if (init.end !== undefined) this.end = init.end
        if (init.size !== undefined) this.size = init.size
      }
    }
  }

  /**
   * Returns the string representation of the header value.
   *
   * @return The header value as a string
   */
  toString(): string {
    if (!this.unit || this.size === undefined) return ''

    let range = this.start !== null && this.end !== null ? `${this.start}-${this.end}` : '*'

    return `${this.unit} ${range}/${this.size}`
  }
}
