import { bench } from '@ark/attest'
import { RoutePattern, type Join } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/')
  pattern.join('/other')
})

bench('join', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.join('/comments/:commentId')
}).types([2445, 'instantiations'])

bench('join > mediarss', async () => {
  let { patterns } = await import('../patterns/mediarss.ts')
  eagerlyEvaluateTypesForJoin(patterns)
}).types([74069, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('join > shopify', async () => {
//   let { patterns } = await import('../patterns/shopify.ts')
//   // @ts-expect-error Type instantiation is excessively deep and possibly infinite. ts(2589)
//   eagerlyEvaluateTypesForJoin(patterns)
// }).types([5169925, 'instantiations'])

function eagerlyEvaluateTypesForJoin<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: Join<patterns[number], string> } extends
    { [pattern in patterns[number]]: string }
    ? patterns : never
  ),
): void {}
