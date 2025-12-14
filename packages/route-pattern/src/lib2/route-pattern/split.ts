import type { Span } from '../span'

export interface SplitResult {
  protocol: Span | undefined
  hostname: Span | undefined
  port: Span | undefined
  pathname: Span | undefined
  search: Span | undefined
}

/**
 * Split a route pattern into protocol, hostname, port, pathname, and search
 * ranges. Ranges are [start (inclusive), end (exclusive)].
 */
export function split<source extends string>(source: source): SplitResult {
  let protocol: Span | undefined
  let hostname: Span | undefined
  let port: Span | undefined
  let pathname: Span | undefined
  let search: Span | undefined

  // search
  let searchStart = source.indexOf('?')
  if (searchStart !== -1) {
    search = [searchStart + 1, source.length]
    source = source.slice(0, searchStart) as source
  }

  let index = 0
  let solidusIndex = source.indexOf('://')
  if (solidusIndex !== -1) {
    // protocol
    if (solidusIndex !== 0) {
      protocol = [0, solidusIndex]
    }
    index = solidusIndex + 3

    // hostname + port
    let hostEndIndex = source.indexOf('/', index)
    if (hostEndIndex === -1) hostEndIndex = source.length

    // detect port (numeric) at end of host segment
    let colonIndex = source.lastIndexOf(':', hostEndIndex - 1)
    if (colonIndex !== -1 && colonIndex >= index) {
      // Ensure everything after the colon is digits
      let isPort = true
      for (let i = colonIndex + 1; i < hostEndIndex; i++) {
        let char = source.charCodeAt(i)
        if (char < 48 /* '0' */ || char > 57 /* '9' */) {
          isPort = false
          break
        }
      }

      if (isPort && colonIndex + 1 < hostEndIndex) {
        // hostname up to colon, port after colon
        hostname = [index, colonIndex]
        port = [colonIndex + 1, hostEndIndex]
      } else {
        hostname = [index, hostEndIndex]
      }
    } else {
      hostname = [index, hostEndIndex]
    }

    index = hostEndIndex === source.length ? hostEndIndex : hostEndIndex + 1
  }

  // pathname
  if (index !== source.length) {
    if (source.charAt(index) === '/') {
      index += 1
    }

    pathname = [index, source.length]
  }

  return { protocol, hostname, port, pathname, search }
}
