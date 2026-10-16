import { type HeaderValue } from './header-value.ts'

function isValidRangeBound(value: number | undefined): boolean {
  return value === undefined || value === Infinity || (Number.isInteger(value) && value >= 0)
}

function isValidResourceSize(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/**
 * Initializer for a {@link Range} header value.
 */
export interface RangeInit {
  /**
   * The unit of the range, typically "bytes"
   */
  unit?: string
  /**
   * The ranges requested. Each range has optional start and end values.
   * - {start: 0, end: 99} = bytes 0-99
   * - {start: 100} = bytes 100- (from 100 to end)
   * - {end: 500} = bytes -500 (last 500 bytes)
   */
  ranges?: Array<{ start?: number; end?: number }>
}

/**
 * The value of a `Range` HTTP header.
 *
 * [MDN `Range` Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range)
 *
 * [HTTP/1.1 Specification](https://httpwg.org/specs/rfc9110.html#field.range)
 */
export class Range implements HeaderValue, RangeInit {
  /**
   * The range unit, typically `bytes`.
   */
  unit: string = ''

  /**
   * Requested byte ranges from the header.
   */
  ranges: Array<{ start?: number; end?: number }> = []

  constructor(init?: string | RangeInit) {
    if (init) return Range.from(init)
  }

  /**
   * Checks if this range can be satisfied for a resource of the given size.
   *
   * @param resourceSize The size of the resource in bytes
   * @returns `false` if the range is malformed or all ranges are beyond the resource size
   */
  canSatisfy(resourceSize: number): boolean {
    // No unit or no ranges means header was malformed or empty
    if (!this.unit || this.ranges.length === 0 || !isValidResourceSize(resourceSize)) return false

    // Validate all ranges first
    for (let range of this.ranges) {
      if (!isValidRangeBound(range.start) || !isValidRangeBound(range.end)) {
        return false
      }
      // At least one bound must be specified
      if (range.start === undefined && range.end === undefined) {
        return false
      }
      // If both are specified, start must be <= end
      if (range.start !== undefined && range.end !== undefined && range.start > range.end) {
        return false
      }
    }

    // Check if at least one range is within the resource
    for (let range of this.ranges) {
      if (range.start === undefined) {
        // Suffix range (e.g., "-500") is satisfiable when its length is non-zero
        if (range.end !== undefined && range.end > 0) return true
        continue
      }
      if (range.start < resourceSize) {
        // At least one range starts within the resource
        return true
      }
    }

    return false
  }

  /**
   * Normalizes the ranges for a resource of the given size.
   * Returns an array of ranges with resolved start and end values.
   * Returns an empty array if no concrete byte positions can be normalized, including for a
   * zero-length resource.
   *
   * @param resourceSize The size of the resource in bytes
   * @returns An array of ranges with resolved start and end values
   */
  normalize(resourceSize: number): Array<{ start: number; end: number }> {
    if (
      !isValidResourceSize(resourceSize) ||
      resourceSize === 0 ||
      !this.canSatisfy(resourceSize)
    ) {
      return []
    }

    return this.ranges.flatMap(({ start, end }) => {
      if (!isValidRangeBound(start) || !isValidRangeBound(end)) {
        return []
      }

      if (start !== undefined && end !== undefined) {
        if (start >= resourceSize) return []

        // Both bounds specified (e.g., "0-99")
        return [
          {
            start,
            end: Math.min(end, resourceSize - 1),
          },
        ]
      } else if (start !== undefined) {
        if (start >= resourceSize) return []

        // Only start specified (e.g., "100-")
        return [
          {
            start,
            end: resourceSize - 1,
          },
        ]
      } else {
        // Only end specified (e.g., "-500" means last 500 bytes)
        if (end === undefined || end === 0) return []

        return [
          {
            start: Math.max(0, resourceSize - end),
            end: resourceSize - 1,
          },
        ]
      }
    })
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    if (!this.unit || this.ranges.length === 0) return ''

    let rangeParts = this.ranges.map((range) => {
      if (range.start !== undefined && range.end !== undefined) {
        return `${range.start}-${range.end}`
      } else if (range.start !== undefined) {
        return `${range.start}-`
      } else if (range.end !== undefined) {
        return `-${range.end}`
      }
      return ''
    })

    return `${this.unit}=${rangeParts.join(',')}`
  }

  /**
   * Parse a Range header value.
   *
   * @param value The header value (string, init object, or null)
   * @returns A Range instance (empty if null)
   */
  static from(value: string | RangeInit | null): Range {
    let header = new Range()

    if (value !== null) {
      if (typeof value === 'string') {
        // Parse: "bytes=200-1000" or "bytes=200-" or "bytes=-500" or "bytes=0-99,200-299"
        let match = value.match(/^(\w+)=(.+)$/)
        if (match) {
          header.unit = match[1]
          let rangeParts = match[2].split(',')

          // Track if any range part is invalid to mark the entire header as malformed
          let hasInvalidPart = false

          for (let part of rangeParts) {
            let rangeMatch = part.trim().match(/^(\d*)-(\d*)$/)
            if (!rangeMatch) {
              // Invalid syntax for this range part
              hasInvalidPart = true
              continue
            }

            let [, startStr, endStr] = rangeMatch
            // At least one bound must be specified
            if (!startStr && !endStr) {
              hasInvalidPart = true
              continue
            }

            let start = startStr ? parseInt(startStr, 10) : undefined
            let end = endStr ? parseInt(endStr, 10) : undefined

            // If both bounds are specified, start must be <= end
            if (start !== undefined && end !== undefined && start > end) {
              hasInvalidPart = true
              continue
            }

            header.ranges.push({ start, end })
          }

          // If any part was invalid, mark as malformed by clearing ranges
          if (hasInvalidPart) {
            header.ranges = []
          }
        }
      } else {
        if (value.unit !== undefined) header.unit = value.unit
        if (value.ranges !== undefined) header.ranges = value.ranges
      }
    }

    return header
  }
}
