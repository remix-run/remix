import { bench } from '@ark/attest'
import { createMatcher, type Match, type Matcher } from '@remix-run/route-pattern/match'

bench.baseline(() => {
  let matcher = createMatcher('/:var/*wild')
  matcher.match('')?.params
})

bench('match > simple route', () => {
  let matcher = createMatcher('/posts/:id')
  let match = matcher.match('https://example.com/posts/123')
  match?.params.id
}).types([921, 'instantiations'])

bench('match > complex route', () => {
  let matcher = createMatcher('/api(/v:major(.:minor))/*path/help')
  matcher.match('https://example.com/api/v1/users/123')?.params
}).types([4542, 'instantiations'])

bench('match > mediarss', async () => {
  let { patterns } = await import('../../patterns/mediarss.ts')
  eagerlyEvaluateTypesForMatchParams(patterns)
}).types([85052, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('match > shopify', async () => {
//   let { patterns } = await import('../../patterns/shopify.ts')
//   eagerlyEvaluateTypesForMatchParams(patterns)
// }).types([1444090, 'instantiations'])

/** Type-only utility to force eager evaluation of match param types */
function eagerlyEvaluateTypesForMatchParams<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: GetMatchParams<ReturnType<Matcher<pattern>['match']>> } extends
    { [pattern in patterns[number]]: Record<string, unknown> | null }
    ? patterns : never
  ),
): void {}

// prettier-ignore
type GetMatchParams<match> =
  match extends Match<string, unknown> ? match['params'] :
  null
