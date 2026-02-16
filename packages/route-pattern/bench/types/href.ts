import { bench } from '@ark/attest'
import { RoutePattern } from '@remix-run/route-pattern'

bench.baseline(() => {
  let pattern = new RoutePattern('/')
  pattern.href()
})

bench('href > simple route', () => {
  let pattern = new RoutePattern('/posts/:id')
  pattern.href({ id: '123' })
}).types([1053, 'instantiations'])

bench('href > complex route', () => {
  let pattern = new RoutePattern('/api(/v:major(.:minor))/*path/help')
  pattern.href({ major: '1', minor: '2', path: 'users', help: 'help' })
}).types([4457, 'instantiations'])

bench('href > mediarss', async () => {
  let { patterns } = await import('../patterns/mediarss.ts')
  eagerlyEvaluateTypesForHrefParams(patterns)
}).types([79052, 'instantiations'])

// NOTE: This benchmark brings type checking to a crawl.
// Uncomment to run the benchmark, but keep it commented to avoid CI failures.
//
// bench('href > shopify', async () => {
//   let { patterns } = await import('../patterns/shopify.ts')
//   // @ts-expect-error Type instantiation is excessively deep and possibly infinite. ts(2589)
//   eagerlyEvaluateTypesForHrefParams(patterns)
// }).types([5027028, 'instantiations'])

/** Type-only utility to force eager evaluation of href param types */
function eagerlyEvaluateTypesForHrefParams<patterns extends ReadonlyArray<string>>(
  // prettier-ignore
  _: patterns & (
    { [pattern in patterns[number]]: Parameters<RoutePattern<pattern>['href']>[0] } extends
    { [pattern in patterns[number]]: Record<string, unknown> | null | undefined }
    ? patterns : never
  ),
): void {}
