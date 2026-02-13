import { bench } from '@ark/attest'
import { RoutePattern, type RoutePatternMatch } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/:var/*wild')
  pattern.match('')?.params
})

bench('match > simple route', () => {
  let pattern = new RoutePattern('/posts/:id')
  let match = pattern.match('https://example.com/posts/123')
  match?.params.id
}).types([762, 'instantiations'])

bench('match > complex route', () => {
  let pattern = new RoutePattern('/api(/v:major(.:minor))/*path/help')
  pattern.match('https://example.com/api/v1/users/123')?.params
}).types([3804, 'instantiations'])

bench('match > mediarss', async () => {
  let { patterns } = await import('../patterns/mediarss.ts')
  eagerlyEvaluateTypesForMatchParams(patterns)
}).types([75002, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('match > shopify', async () => {
//   let { patterns } = await import('../patterns/shopify.ts')
//   // @ts-expect-error Type instantiation is excessively deep and possibly infinite. ts(2589)
//   eagerlyEvaluateTypesForMatchParams(patterns)
// }).types([5003571, 'instantiations'])

/** Type-only utility to force eager evaluation of match param types */
function eagerlyEvaluateTypesForMatchParams<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: GetMatchParams<ReturnType<RoutePattern<pattern>['match']>> } extends
    { [pattern in patterns[number]]: Record<string, unknown> | null }
    ? patterns : never
  ),
): void {}

// prettier-ignore
type GetMatchParams<match extends RoutePatternMatch<string> | null> =
  match extends RoutePatternMatch<string> ? match['params'] :
  null
