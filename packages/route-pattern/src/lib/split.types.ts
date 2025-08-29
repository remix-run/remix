export type Split<T extends string> = OmitEmptyStringValues<_Split<T>>

// prettier-ignore
type _Split<T extends string> =
  T extends `${infer L}?${infer R}` ? _Split<L> & { search: R } :
  T extends `${infer Protocol}://${infer R}` ?
    Protocol extends `${string}/${string}` ? { pathname: T } :
    R extends `${infer Host}/${infer Pathname}` ? _SplitHost<Host> & { protocol: Protocol; pathname: Pathname } :
    _SplitHost<R> & { protocol: Protocol } :
  { pathname: T }

// Split host string into { hostname, port }
// prettier-ignore
type _SplitHost<T extends string> =
  T extends `${infer L}:${infer R}` ?
    IsDigits<R> extends true ? { hostname: L; port: R} :
    _SplitHost<R> extends { hostname: infer H extends string; port: infer P extends string } ? { hostname: `${L}:${H}`; port: P } :
    { hostname: T } :
  { hostname: T }

// Digits ------------------------------------------------------------------------------------------

// prettier-ignore
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

// prettier-ignore
type IsDigits<S extends string> =
  S extends `${_0_9}${infer T}` ?
    T extends '' ? true :
    IsDigits<T> :
  false

// Utils -------------------------------------------------------------------------------------------

type OmitEmptyStringValues<S> = { [K in keyof S as S[K] extends '' ? never : K]: S[K] }
