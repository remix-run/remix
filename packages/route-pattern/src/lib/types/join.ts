import type { Parse, ParsedPattern, Separator, Token } from './parse'
import type { StartsWithSeparator, Stringify } from './stringify'

/**
 * Join two pattern strings together.
 */
export type Join<A extends string, B extends string> = _Join<Parse<A>, Parse<B>>

type _Join<A extends ParsedPattern, B extends ParsedPattern> = Stringify<{
  protocol: JoinOriginField<A, B, 'protocol'>
  hostname: JoinOriginField<A, B, 'hostname'>
  port: JoinOriginField<A, B, 'port'>
  pathname: JoinPathnames<A['pathname'], B['pathname']>
  search: JoinSearch<A['search'], B['search']>
}>

// prettier-ignore
type JoinOriginField<
  A extends ParsedPattern,
  B extends ParsedPattern,
  Field extends 'protocol' | 'hostname' | 'port'
> = B['hostname'] extends Token[] ? B[Field] : A[Field]

// prettier-ignore
type JoinPathnames<A extends Token[] | undefined, B extends Token[] | undefined> =
  B extends undefined ? A :
  B extends [] ? A :
  A extends undefined ? B :
  A extends [] ? B :
  A extends Token[] ?
    B extends Token[] ? JoinPathnameTokens<RemoveTrailingSeparator<A>, B> :
    never :
  never

// prettier-ignore
type RemoveTrailingSeparator<T extends Token[]> =
  T extends [...infer Rest extends Token[], Separator] ? Rest : T

// prettier-ignore
type JoinPathnameTokens<
  A extends Token[],
  B extends Token[]
> = B extends [Separator] ?
    A :
    StartsWithSeparator<B> extends true ?
      [...A, ...B] :
      [...A, Separator, ...B]

// prettier-ignore
type JoinSearch<
  A extends string | undefined,
  B extends string | undefined
> = B extends undefined ? A :
    A extends undefined ? B :
    `${A}&${B}`
