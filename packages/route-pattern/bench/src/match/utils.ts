import { bench, describe } from 'vitest'
import type { Matcher } from '@remix-run/route-pattern'

export type BenchMatcher = {
  name: string
  createMatcher: () => Matcher<null>
}

type MatchBenchOptions<matcher extends BenchMatcher> = {
  matchers: ReadonlyArray<matcher>
  patterns: ReadonlyArray<string> | ((matcher: matcher) => ReadonlyArray<string>)
  urls: ReadonlyArray<URL>
}

function cycle<item>(items: ReadonlyArray<item>) {
  if (items.length === 0) {
    throw new Error('Expected at least one item')
  }

  let index = 0

  return () => {
    let item = items[index]!
    index = (index + 1) % items.length
    return item
  }
}

function getPatterns<matcher extends BenchMatcher>(
  options: MatchBenchOptions<matcher>,
  matcher: matcher,
): ReadonlyArray<string> {
  return typeof options.patterns === 'function' ? options.patterns(matcher) : options.patterns
}

function createMatcher<matcher extends BenchMatcher>(
  matcher: matcher,
  patterns: ReadonlyArray<string>,
) {
  let instance = matcher.createMatcher()

  for (let pattern of patterns) {
    instance.add(pattern, null)
  }

  return instance
}

function createPatternLookup<matcher extends BenchMatcher>(options: MatchBenchOptions<matcher>) {
  return Object.fromEntries(
    options.matchers.map((matcher) => [matcher.name, getPatterns(options, matcher)]),
  )
}

function createMatcherLookup<matcher extends BenchMatcher>(
  options: MatchBenchOptions<matcher>,
  patternsByMatcherName: Record<string, ReadonlyArray<string>>,
) {
  return Object.fromEntries(
    options.matchers.map((matcher) => [
      matcher.name,
      createMatcher(matcher, patternsByMatcherName[matcher.name]!),
    ]),
  )
}

function verifyMatches<matcher extends BenchMatcher>(options: MatchBenchOptions<matcher>) {
  let baselineMatcher = options.matchers[0]

  if (!baselineMatcher) {
    throw new Error('Expected at least one matcher')
  }

  let patternsByMatcherName = createPatternLookup(options)
  let matchersByName = createMatcherLookup(options, patternsByMatcherName)

  for (let url of options.urls) {
    let expected = matchersByName[baselineMatcher.name]!.match(url) !== null

    for (let matcher of options.matchers.slice(1)) {
      let actual = matchersByName[matcher.name]!.match(url) !== null

      if (actual !== expected) {
        throw new Error(
          `Matcher '${matcher.name}' mismatch on '${url.href}': expected ${expected ? 'match' : 'no match'}, but got ${actual ? 'match' : 'no match'}`,
        )
      }
    }
  }
}

function benchServer<matcher extends BenchMatcher>(options: MatchBenchOptions<matcher>) {
  describe('server', () => {
    let nextUrl = cycle(options.urls)
    let patternsByMatcherName = createPatternLookup(options)
    let matchersByName = createMatcherLookup(options, patternsByMatcherName)

    for (let matcher of options.matchers) {
      bench(matcher.name, () => {
        matchersByName[matcher.name]!.match(nextUrl())
      })
    }
  })
}

function benchLambda<matcher extends BenchMatcher>(options: MatchBenchOptions<matcher>) {
  describe('lambda', () => {
    let nextUrl = cycle(options.urls)
    let patternsByMatcherName = createPatternLookup(options)

    for (let matcher of options.matchers) {
      bench(matcher.name, () => {
        let instance = createMatcher(matcher, patternsByMatcherName[matcher.name]!)
        instance.match(nextUrl())
      })
    }
  })
}

export function benchMatchers<matcher extends BenchMatcher>(options: MatchBenchOptions<matcher>) {
  verifyMatches(options)
  benchServer(options)
  benchLambda(options)
}
