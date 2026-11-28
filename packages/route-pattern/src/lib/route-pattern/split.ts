export type Span = [begin: number, end: number]

export type SplitResult = {
  protocol: Span | null
  hostname: Span | null
  port: Span | null
  pathname: Span | null
  search: Span | null
}

/**
 * Split a route pattern into protocol, hostname, port, pathname, and search
 * spans delimited as `protocol://hostname:port/pathname?search`.
 *
 * Delimiters are not included in the spans with the exception of the leading `/` for pathname.
 * Spans are [begin (inclusive), end (exclusive)].
 *
 * @param source the route pattern string to split
 * @returns an object containing spans for each URL component
 */
export function split(source: string): SplitResult {
  let result: SplitResult = {
    protocol: null,
    hostname: null,
    port: null,
    pathname: null,
    search: null,
  }

  let end = source.length
  let questionMarkIndex = source.indexOf('?')
  if (questionMarkIndex !== -1) {
    result.search = span(questionMarkIndex + 1, end)
    end = questionMarkIndex
  }

  let solidusIndex = source.indexOf('://')
  if (solidusIndex === -1 || solidusIndex >= end) {
    result.pathname = pathnameSpan(source, 0, end)
    return result
  }

  let firstSlash = source.indexOf('/')
  if (firstSlash !== -1 && firstSlash < solidusIndex) {
    result.pathname = pathnameSpan(source, 0, end)
    return result
  }

  let slashIndex = source.indexOf('/', solidusIndex + 3)
  let hostEnd = slashIndex === -1 || slashIndex >= end ? end : slashIndex

  result.protocol = span(0, solidusIndex)
  let host = span(solidusIndex + 3, hostEnd)
  if (host) {
    let { hostname, port } = hostSpans(source, host)
    result.hostname = hostname
    result.port = port
  }
  if (slashIndex !== -1 && slashIndex < end) {
    result.pathname = pathnameSpan(source, slashIndex, end)
  }
  return result
}

function span(start: number, end: number): Span | null {
  return start === end ? null : [start, end]
}

function hostSpans(source: string, host: Span): { hostname: Span | null; port: Span | null } {
  let lastColonIndex = source.lastIndexOf(':', host[1] - 1)
  if (lastColonIndex < host[0]) return { hostname: host, port: null }

  if (isAllDigits(source, lastColonIndex + 1, host[1])) {
    return { hostname: span(host[0], lastColonIndex), port: span(lastColonIndex + 1, host[1]) }
  }
  return { hostname: host, port: null }
}

function isAllDigits(source: string, start: number, end: number): boolean {
  if (start >= end) return false
  for (let i = start; i < end; i++) {
    let code = source.charCodeAt(i)
    if (code < 48 || code > 57) return false
  }
  return true
}

function pathnameSpan(source: string, begin: number, end: number): Span | null {
  if (begin < end && source.charCodeAt(begin) === 47) begin += 1
  return span(begin, end)
}
