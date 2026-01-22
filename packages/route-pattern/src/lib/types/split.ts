export interface SplitPattern {
  protocol: string | undefined
  hostname: string | undefined
  port: string | undefined
  pathname: string | undefined
  search: string | undefined
}

// prettier-ignore
export type Split<T extends string> =
  _Split<T> extends infer S extends Partial<SplitPattern> ? {
    protocol: S['protocol'] extends string ? S['protocol'] : undefined
    hostname: S['hostname'] extends string ? S['hostname'] : undefined
    port: S['port'] extends string ? S['port'] : undefined
    pathname: S['pathname'] extends string ? S['pathname'] : undefined
    search: S['search'] extends string ? S['search'] : undefined
  } :
  never

// prettier-ignore
type _Split<T extends string> =
  T extends '' ? {} :
  T extends `${infer L}?${infer R}` ? _Split<L> & { search: R } :
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
