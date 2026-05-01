import type { Split, SplitPattern } from './split.ts'
import type { Simplify } from './utils.ts'

/** Extracted route params for a route-pattern source string. */
export type Params<source extends string> = Simplify<Omit<ParseParams<Split<source>>, '*'>>

// prettier-ignore
export type ParseParams<split extends SplitPattern> =
  split extends { hostname: infer hostname, pathname: infer pathname } ?
    & (hostname extends string ? ParsePartParams<hostname> : {})
    & (pathname extends string ? ParsePartParams<pathname> : {})
  :
  never

// prettier-ignore
type ParsePartParams<source, stack extends Array<null> = []> =
  string extends source ? Record<string, string | undefined> :
  source extends `${infer char extends '\\' | ':' | '*' | '(' | ')'}${infer rest}` ?
    char extends '\\' ?
      rest extends `${string}${infer rest}` ?
        ParsePartParams<rest, stack> :
        never
    :
    char extends ':' ?
      IdentifierParse<rest> extends { identifier: infer name extends string, rest: infer rest } ?
        Param<name, stack> & ParsePartParams<rest, stack>
      :
      never
    :
    char extends '*' ?
      IdentifierParse<rest> extends { identifier: infer name extends string, rest: infer rest } ?
        Param<name extends '' ? '*' : name, stack> & ParsePartParams<rest, stack>
      :
      never
    :
    char extends '(' ? ParsePartParams<rest, [...stack, null]> :
    char extends ')' ?
      stack extends [null, ...infer tail extends Array<null>] ?
        ParsePartParams<rest, tail> :
        never
    :
    never
  :
  source extends `${string}${infer rest}` ? ParsePartParams<rest, stack> :
  {}

type Param<name extends string, stack extends Array<null>> = stack extends []
  ? { [key in name]: string }
  : { [key in name]: string | undefined }

type IdentifierHead = a_z | A_Z | '_' | '$'
type IdentifierTail = IdentifierHead | _0_9

type IdentifierParse<source extends string> = _IdentifierParse<{ identifier: ''; rest: source }>

// prettier-ignore
type _IdentifierParse<state extends { identifier: string, rest: string }> =
  state extends { identifier: '', rest: `${infer head extends IdentifierHead}${infer tail}` } ?
    _IdentifierParse<{ identifier: head, rest: tail }>
  :
  state extends { identifier: string, rest: `${infer head extends IdentifierTail}${infer rest}`} ?
    _IdentifierParse<{ identifier: `${state['identifier']}${head}`, rest: rest }>
  :
  state

// prettier-ignore
type a_z = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
type A_Z = Uppercase<a_z>
type _0_9 = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
