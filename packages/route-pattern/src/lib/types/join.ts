import type { Parse, ParsedPattern, Separator, Token } from './parse.ts'
import type { StartsWithSeparator, Stringify } from './stringify.ts'

/** Join two pattern source strings together at the type level. */
export type JoinPatterns<A extends string, B extends string> = string extends A | B
  ? string
  : _JoinPatterns<Parse<A>, Parse<B>>

// oxfmt-ignore
type _JoinPatterns<A, B> =
  A extends never ? never :
  B extends never ? never :
  A extends ParsedPattern ?
    B extends ParsedPattern ?
      Stringify<{
        protocol: JoinOriginField<A, B, 'protocol'>
        hostname: JoinOriginField<A, B, 'hostname'>
        port: JoinOriginField<A, B, 'port'>
        pathname: JoinPathnames<A['pathname'], B['pathname']>
        search: JoinSearch<A['search'], B['search']>
      }> :
      never :
    never

// oxfmt-ignore
type JoinOriginField<
  A extends ParsedPattern,
  B extends ParsedPattern,
  Field extends 'protocol' | 'hostname' | 'port'
> = B[Field] extends undefined ? A[Field] : B[Field]

// oxfmt-ignore
type JoinPathnames<A extends Token[] | undefined, B extends Token[] | undefined> =
  B extends undefined ? A :
  B extends [] ? A :
  A extends undefined ? B :
  A extends [] ? B :
  A extends Token[] ?
    B extends Token[] ? JoinPathnameTokens<RemoveTrailingSeparator<A>, B> :
    never :
  never

// oxfmt-ignore
type RemoveTrailingSeparator<T extends Token[]> =
  T extends [...infer Rest extends Token[], Separator] ? Rest : T

// oxfmt-ignore
type JoinPathnameTokens<A extends Token[], B extends Token[]> =
  B extends [Separator] ? A :
  StartsWithSeparator<B> extends true ? [...A, ...B] :
  [...A, Separator, ...B]

// oxfmt-ignore
type JoinSearch<A extends string | undefined, B extends string | undefined> =
  B extends undefined ? A :
  A extends undefined ? B :
  `${A}&${B}`
