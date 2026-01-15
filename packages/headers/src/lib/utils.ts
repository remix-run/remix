export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function isIterable<T>(value: any): value is Iterable<T> {
  return value != null && typeof value[Symbol.iterator] === 'function'
}

export function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

export function quoteEtag(tag: string): string {
  return tag === '*' ? tag : /^(W\/)?".*"$/.test(tag) ? tag : `"${tag}"`
}

/**
 * Removes milliseconds from a timestamp, returning seconds.
 * HTTP dates only have second precision, so this is useful for date comparisons.
 *
 * @param time The timestamp or Date to truncate
 * @returns The timestamp in seconds (milliseconds removed)
 */
export function removeMilliseconds(time: number | Date): number {
  let timestamp = time instanceof Date ? time.getTime() : time
  return Math.floor(timestamp / 1000)
}

const imfFixdatePattern =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/

/**
 * Parses an HTTP date header value.
 *
 * HTTP dates must follow RFC 7231 IMF-fixdate format:
 * "Day, DD Mon YYYY HH:MM:SS GMT" (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
 *
 * [RFC 7231 Section 7.1.1.1](https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.1.1)
 *
 * @param dateString The HTTP date string to parse
 * @returns The timestamp in milliseconds, or null if invalid
 */
export function parseHttpDate(dateString: string): number | null {
  if (!imfFixdatePattern.test(dateString)) {
    return null
  }

  let timestamp = Date.parse(dateString)
  if (isNaN(timestamp)) {
    return null
  }

  return timestamp
}
