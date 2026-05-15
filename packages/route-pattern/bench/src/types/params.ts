import type { MatchParams } from '@remix-run/route-pattern/match'
import { bench } from '@ark/attest'

bench.baseline(() => {
  type _ = MatchParams<''>
})

bench('simple > MatchParams', () => {
  type _ = MatchParams<'posts/:id'>
}).types([381, 'instantiations'])

bench('complex > MatchParams', () => {
  type _ = MatchParams<'api(/v:major(.:minor))/*path/help'>
}).types([1083, 'instantiations'])

bench('mediarss > MatchParams', async () => {
  let { patterns } = await import('../../patterns/mediarss.ts')
  eagerlyEvaluateTypesForParams(patterns)
}).types([12140, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('shopify > MatchParams', async () => {
//   let { patterns } = await import('../../patterns/shopify.ts')
//   eagerlyEvaluateTypesForParams(patterns)
// }).types([1424185, 'instantiations'])

function eagerlyEvaluateTypesForParams<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: MatchParams<pattern> } extends
    { [pattern in patterns[number]]: Record<string, unknown> }
    ? patterns : never
  ),
): void {}
