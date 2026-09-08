import { bench, describe } from 'vitest'
import type { Match, MultiMatcher } from '@remix-run/route-pattern/match'

export type BenchMatcher = {
  name: string
  supportsDetailedVerification?: boolean
  createMatcher: () => MultiMatcher<unknown>
}

type BenchData = {
  index: number
  pattern: string
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
  let instance = matcher.createMatcher() as MultiMatcher<BenchData>

  for (let [index, pattern] of patterns.entries()) {
    instance.add(pattern, { index, pattern })
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
    let expectedMatch = matchersByName[baselineMatcher.name]!.match(url)
    let expected = expectedMatch !== null

    for (let matcher of options.matchers.slice(1)) {
      let instance = matchersByName[matcher.name]!
      let actualMatch = instance.match(url)
      let actual = actualMatch !== null

      if (actual !== expected) {
        throw new Error(
          `Matcher '${matcher.name}' mismatch on '${url.href}': expected ${expected ? 'match' : 'no match'}, but got ${actual ? 'match' : 'no match'}`,
        )
      }

      if (
        actualMatch &&
        expectedMatch &&
        baselineMatcher.supportsDetailedVerification &&
        matcher.supportsDetailedVerification
      ) {
        assertMatchEqual(matcher.name, url, actualMatch, expectedMatch)
        assertMatchesEqual(
          matcher.name,
          url,
          instance.matchAll(url),
          matchersByName[baselineMatcher.name]!.matchAll(url),
        )
      }
    }
  }
}

function assertMatchesEqual(
  matcherName: string,
  url: URL,
  actual: Array<Match<string, BenchData>>,
  expected: Array<Match<string, BenchData>>,
) {
  actual = dedupeMatchesByInsertedPattern(actual)
  expected = dedupeMatchesByInsertedPattern(expected)

  if (actual.length !== expected.length) {
    throw new Error(
      `Matcher '${matcherName}' matchAll mismatch on '${url.href}': expected ${expected.length} matches, but got ${actual.length}`,
    )
  }

  for (let index = 0; index < expected.length; index++) {
    assertMatchEqual(`${matcherName} matchAll[${index}]`, url, actual[index]!, expected[index]!)
  }
}

function dedupeMatchesByInsertedPattern(
  matches: Array<Match<string, BenchData>>,
): Array<Match<string, BenchData>> {
  let seen = new Set<number>()
  let result: Array<Match<string, BenchData>> = []

  for (let match of matches) {
    if (seen.has(match.data.index)) continue
    seen.add(match.data.index)
    result.push(match)
  }

  return result
}

function assertMatchEqual(
  matcherName: string,
  url: URL,
  actual: Match<string, BenchData>,
  expected: Match<string, BenchData>,
) {
  let actualPattern = actual.pattern.toString()
  let expectedPattern = expected.pattern.toString()
  if (actualPattern !== expectedPattern) {
    throw new Error(
      `Matcher '${matcherName}' selected pattern mismatch on '${url.href}': expected '${expectedPattern}', but got '${actualPattern}'`,
    )
  }

  assertJsonEqual(matcherName, url, 'params', actual.params, expected.params)
  assertJsonEqual(matcherName, url, 'data', actual.data, expected.data)
}

function assertJsonEqual(
  matcherName: string,
  url: URL,
  label: string,
  actual: unknown,
  expected: unknown,
) {
  let actualJson = JSON.stringify(actual)
  let expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(
      `Matcher '${matcherName}' ${label} mismatch on '${url.href}': expected ${expectedJson}, but got ${actualJson}`,
    )
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
