import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'
import { joinPatterns, type JoinPatterns } from '@remix-run/route-pattern/join'

bench.baseline(() => {
  let pattern = RoutePattern.parse('/')
  joinPatterns(pattern, '/other')
})

bench('join', () => {
  let pattern = RoutePattern.parse('/posts/:id')
  joinPatterns(pattern, '/comments/:commentId')
}).types([2651, 'instantiations'])

bench('join > mediarss', async () => {
  let { patterns } = await import('../../patterns/mediarss.ts')
  eagerlyEvaluateTypesForJoin(patterns)
}).types([153, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('join > shopify', async () => {
//   let { patterns } = await import('../../patterns/shopify.ts')
//   // @ts-expect-error Type instantiation is excessively deep and possibly infinite. ts(2589)
//   eagerlyEvaluateTypesForJoin(patterns)
// }).types([5169925, 'instantiations'])

function eagerlyEvaluateTypesForJoin<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: JoinPatterns<patterns[number], string> } extends
    { [pattern in patterns[number]]: string }
    ? patterns : never
  ),
): void {}
