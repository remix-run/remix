export {
  RoutePattern,
  type RoutePatternOptions,
  type RoutePatternMatch,
} from './lib/route-pattern.ts'
export type { Join, HrefArgs, Params } from './lib/types/index.ts'

// matchers
export { type Matcher, type Match } from './lib/matcher.ts'
export { ArrayMatcher } from './lib/array-matcher.ts'
export { TrieMatcher } from './lib/trie-matcher.ts'

// errors
export { ParseError } from './lib/errors.ts'
export { HrefError } from './lib/route-pattern/href.ts'
