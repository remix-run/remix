export type Split<T extends string> = OmitEmptyStringValues<_Split<T>>

// prettier-ignore
type _Split<T extends string> =
  T extends `${infer L}?${infer R}` ? _Split<L> & { search: R } :
  T extends `${infer Protocol}://${infer R}` ?
    Protocol extends `${string}/${string}` ? { pathname: T } :
    R extends `${infer Host}/${infer Pathname}` ? (
      _HostSplit<Host> & { protocol: Protocol; pathname: Pathname }
    ) : (
      _HostSplit<R> & { protocol: Protocol }
    ) :
  { pathname: T };

// Host splitting with numeric-only port at end
// Find the rightmost colon followed by digits only
// prettier-ignore
type _HostSplit<Host extends string> = _FindRightmostPort<Host>

// Find rightmost port by recursively checking from right to left
// prettier-ignore
type _FindRightmostPort<Host extends string> = 
  Host extends `${infer Before}:${infer After}`
    ? After extends `${string}:${string}`
      ? // After contains colon, recurse on the After part and prepend Before
        _FindRightmostPort<After> extends { hostname: infer H extends string; port: infer P extends string }
          ? { hostname: `${Before}:${H}`; port: P }
          : { hostname: Host }
      : // After has no colon, check if it's digits
        IsDigits<After> extends true
          ? { hostname: Before; port: After }
          : { hostname: Host }
    : { hostname: Host }

// Digits ------------------------------------------------------------------------------------------

// prettier-ignore
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

type IsDigits<S extends string> = S extends ''
  ? false
  : S extends `${infer H}${infer T}`
    ? H extends _0_9
      ? T extends ''
        ? true
        : IsDigits<T>
      : false
    : false

// Utils -------------------------------------------------------------------------------------------

type OmitEmptyStringValues<S> = { [K in keyof S as S[K] extends '' ? never : K]: S[K] }
