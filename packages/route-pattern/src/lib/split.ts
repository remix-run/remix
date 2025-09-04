export interface SplitResult {
  protocol?: string
  hostname?: string
  port?: string
  pathname?: string
  search?: string
}

type OmitEmptyStringValues<S> = { [K in keyof S as S[K] extends '' ? never : K]: S[K] }

export type Split<T extends string> = OmitEmptyStringValues<_Split<T>>

// prettier-ignore
type _Split<T extends string> =
  T extends `${infer L}?${infer R}` ? _Split<L> & { search: R } :
  T extends `${infer Protocol}://${infer R}` ?
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

export function split<T extends string>(source: T): Split<T> {
  let result = {} as any

  // search
  let searchStart = source.indexOf('?')
  if (searchStart !== -1) {
    result.search = source.slice(searchStart + 1, source.length)
    source = source.slice(0, searchStart) as T
  }

  let index = 0
  let solidus = source.indexOf('://')
  if (solidus !== -1) {
    // protocol
    if (solidus !== 0) {
      result.protocol = source.slice(0, solidus)
    }
    index = solidus + 3

    // hostname + port
    let hostEnd = source.indexOf('/', index)
    if (hostEnd === -1) hostEnd = source.length

    // detect port (numeric) at end of host segment
    let host = source.slice(index, hostEnd)
    let colonIndex = host.lastIndexOf(':')
    if (colonIndex !== -1) {
      let afterColon = host.slice(colonIndex + 1)
      if (/^[0-9]+$/.test(afterColon)) {
        // hostname up to colon, port after colon
        result.hostname = source.slice(index, index + colonIndex)
        result.port = source.slice(index + colonIndex + 1, hostEnd)
      } else {
        result.hostname = source.slice(index, hostEnd)
      }
    } else {
      result.hostname = source.slice(index, hostEnd)
    }
    index = hostEnd === source.length ? hostEnd : hostEnd + 1
  }

  // pathname
  if (index !== source.length) {
    let pathname = source.slice(index, source.length)
    if (pathname.startsWith('/')) {
      result.pathname = pathname.slice(1)
    } else {
      result.pathname = pathname
    }
  }

  return result as Split<T>
}
