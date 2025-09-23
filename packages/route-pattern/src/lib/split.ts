type Range = [number, number] // [start (inclusive), end (exclusive)]

export interface SplitResult {
  protocol: Range | undefined
  hostname: Range | undefined
  port: Range | undefined
  pathname: Range | undefined
  search: Range | undefined
}

/**
 * Split a route pattern into protocol, hostname, port, pathname, and search
 * ranges. Ranges are [start (inclusive), end (exclusive)].
 */
export function split<T extends string>(source: T): SplitResult {
  let protocol: Range | undefined
  let hostname: Range | undefined
  let port: Range | undefined
  let pathname: Range | undefined
  let search: Range | undefined

  // search
  let searchStart = source.indexOf('?')
  if (searchStart !== -1) {
    search = [searchStart + 1, source.length]
    source = source.slice(0, searchStart) as T
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

export function splitStrings(source: string) {
  let ranges = split(source)
  return {
    protocol: ranges.protocol ? source.slice(...ranges.protocol) : undefined,
    hostname: ranges.hostname ? source.slice(...ranges.hostname) : undefined,
    port: ranges.port ? source.slice(...ranges.port) : undefined,
    pathname: ranges.pathname ? source.slice(...ranges.pathname) : undefined,
    search: ranges.search ? source.slice(...ranges.search) : undefined,
  }
}

export interface PatternParts {
  protocol: string | undefined
  hostname: string | undefined
  port: string | undefined
  pathname: string | undefined
  search: string | undefined
}

// prettier-ignore
export type Split<T extends string> =
  SplitPattern<T> extends infer S extends Partial<PatternParts> ? {
    protocol: S['protocol'] extends string ? S['protocol'] : undefined
    hostname: S['hostname'] extends string ? S['hostname'] : undefined
    port: S['port'] extends string ? S['port'] : undefined
    pathname: S['pathname'] extends string ? S['pathname'] : undefined
    search: S['search'] extends string ? S['search'] : undefined
  } :
  never

// prettier-ignore
type SplitPattern<T extends string> =
  T extends '' ? {} :
  T extends `${infer L}?${infer R}` ? SplitPattern<L> & { search: R } :
  T extends `${infer Protocol}://${infer R}` ?
    Protocol extends '' ? (
      R extends `${infer Host}/${infer Pathname}` ? SplitHost<Host> & { pathname: Pathname } :
      SplitHost<R>
    ) :
    Protocol extends `${string}/${string}` ? { pathname: T } :
    R extends `${infer Host}/${infer Pathname}` ? SplitHost<Host> & { protocol: Protocol; pathname: Pathname } :
    SplitHost<R> & { protocol: Protocol } :
  T extends `/${infer Pathname}` ? { pathname: Pathname } :
  { pathname: T }

// prettier-ignore
type SplitHost<T extends string> =
  T extends `${infer L}:${infer R}` ?
    IsDigits<R> extends true ? { hostname: L; port: R} :
    SplitHost<R> extends { hostname: infer H extends string; port: infer P extends string } ? { hostname: `${L}:${H}`; port: P } :
    { hostname: T } :
  { hostname: T }

type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

// prettier-ignore
type IsDigits<S extends string> =
  S extends `${_0_9}${infer T}` ?
    T extends '' ? true :
    IsDigits<T> :
  false
