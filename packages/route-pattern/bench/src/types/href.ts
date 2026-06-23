import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'
import { createHref, type CreateHrefArgs } from '@remix-run/route-pattern/href'

bench.baseline(() => {
  createHref('/')
})

bench('href > simple route', () => {
  let pattern = RoutePattern.parse('/posts/:id')
  createHref(pattern, { id: '123' })
}).types([1248, 'instantiations'])

bench('href > complex route', () => {
  let pattern = RoutePattern.parse('/api(/v:major(.:minor))/*path/help')
  createHref(pattern, { major: '1', minor: '2', path: 'users', help: 'help' })
}).types([4944, 'instantiations'])

bench('href > mediarss', async () => {
  let { patterns } = await import('../../patterns/mediarss.ts')
  eagerlyEvaluateTypesForHrefParams(patterns)
}).types([87455, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('href > shopify', async () => {
//   let { patterns } = await import('../../patterns/shopify.ts')
//   eagerlyEvaluateTypesForHrefParams(patterns)
// }).types([1540592, 'instantiations'])

/** Type-only utility to force eager evaluation of href param types */
function eagerlyEvaluateTypesForHrefParams<patterns extends ReadonlyArray<string>>(
  // oxfmt-ignore
  _: patterns & (
    { [pattern in patterns[number]]: CreateHrefArgs<pattern>[0] } extends
    { [pattern in patterns[number]]: Record<string, unknown> | null | undefined }
    ? patterns : never
  ),
): void {}
