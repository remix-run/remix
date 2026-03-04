export { RoutePattern, type RoutePatternMatch, type AST } from './lib/route-pattern.ts'
export type { Join, Params } from './lib/types/index.ts'
export type { _Join } from './lib/types/join.ts'
export type { Parse } from './lib/types/parse.ts'
export type { BuildParams, RequiredParams } from './lib/types/params.ts'
export { ParseError, type ParseErrorType } from './lib/route-pattern/parse.ts'
export {
  type HrefArgs,
  type HrefErrorDetails,
  type HrefParamsArg,
  type HrefSearchParams,
  HrefError,
} from './lib/route-pattern/href.ts'
export type { PartPatternMatch } from './lib/route-pattern/part-pattern.ts'

export { type Matcher, type Match, type CompareFn } from './lib/matcher.ts'
export { ArrayMatcher } from './lib/array-matcher.ts'
export { TrieMatcher, type Trie } from './lib/trie-matcher.ts'
