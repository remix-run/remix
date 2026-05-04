import type { MatcherOptions } from './matcher/types.ts'
import { TrieMatcher } from './matcher/trie.ts'

export function createPatternMatcher<data = unknown>(options?: MatcherOptions) {
  return new TrieMatcher<data>(options)
}
